-- Final customer-transfer capacity is decided here, not by a prior read in a
-- Vercel instance. `target_contract_total_cents` is projected server-side from
-- the immutable reservation snapshot: keeping that projection in TypeScript
-- avoids a second, fragile interpretation of the snapshot JSON in SQL.
create function public.finalize_customer_transfer_payment_atomic(
  target_agency_id uuid,
  target_reservation_id uuid,
  target_customer_account_id uuid,
  target_payment_id uuid,
  target_contract_total_cents bigint,
  target_amount_cents bigint,
  target_currency text,
  target_reference text,
  target_paid_at timestamptz,
  target_idempotency_key uuid,
  target_storage_path text,
  target_mime_type text,
  target_file_size_bytes bigint
) returns table (result_status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  snapshot_row public.reservation_snapshots%rowtype;
  existing_payment public.reservation_payments%rowtype;
  confirmed_total_cents bigint := 0;
  pending_total_cents bigint := 0;
  reportable_remaining_cents bigint := 0;
begin
  -- This row lock scopes serialization to one tenant reservation only.
  select * into snapshot_row
  from public.reservation_snapshots
  where id = target_reservation_id
    and agency_id = target_agency_id
  for update;
  if not found then
    return query select 'not_found'::text;
    return;
  end if;

  -- Defense in depth for the already-authorized customer account.
  if not exists (
    select 1
    from public.reservation_customer_access as reservation_access
    join public.agency_customer_accounts as customer_account
      on customer_account.id = reservation_access.customer_account_id
     and customer_account.agency_id = reservation_access.agency_id
    where reservation_access.reservation_id = target_reservation_id
      and reservation_access.agency_id = target_agency_id
      and reservation_access.customer_account_id = target_customer_account_id
      and customer_account.status = 'active'
  ) then
    return query select 'forbidden'::text;
    return;
  end if;

  if target_contract_total_cents <= 0
    or target_amount_cents <= 0
    or target_amount_cents > 999999999999
    or target_currency is null
    or char_length(target_currency) <> 3
    or snapshot_row.currency <> target_currency
    or target_paid_at is null
    or (target_reference is not null and char_length(target_reference) > 120)
    or btrim(coalesce(target_storage_path, '')) = ''
    or target_mime_type not in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
    or target_file_size_bytes <= 0
  then
    return query select 'invalid_structure'::text;
    return;
  end if;

  -- Idempotency precedes capacity: an established logical report never needs
  -- to reserve capacity a second time. A historical missing evidence row can
  -- be reconciled only when this request targets that exact payment ID.
  select * into existing_payment
  from public.reservation_payments
  where agency_id = target_agency_id
    and idempotency_key = target_idempotency_key;
  if found then
    if existing_payment.reservation_id <> target_reservation_id
      or existing_payment.submitted_by_customer_account_id is distinct from target_customer_account_id
      or existing_payment.amount <> (target_amount_cents::numeric / 100)
      or existing_payment.currency <> target_currency
      or existing_payment.status <> 'pending'
      or existing_payment.method <> 'transfer'
      or existing_payment.source <> 'customer'
      or existing_payment.reference is distinct from target_reference
      or existing_payment.paid_at is distinct from target_paid_at
    then
      return query select 'idempotency_conflict'::text;
      return;
    end if;

    if exists (
      select 1 from public.payment_evidence
      where payment_id = existing_payment.id
        and reservation_id = target_reservation_id
        and agency_id = target_agency_id
    ) then
      return query select 'existing'::text;
      return;
    end if;

    if existing_payment.id <> target_payment_id then
      return query select 'invalid_structure'::text;
      return;
    end if;

    insert into public.payment_evidence (
      payment_id, reservation_id, agency_id, storage_path, mime_type,
      file_size_bytes, uploaded_by_user_id
    ) values (
      existing_payment.id, target_reservation_id, target_agency_id,
      target_storage_path, target_mime_type, target_file_size_bytes, null
    );
    return query select 'existing'::text;
    return;
  end if;

  if exists (
    select 1
    from public.reservation_payments
    where reservation_id = target_reservation_id
      and agency_id = target_agency_id
      and currency <> target_currency
  ) then
    return query select 'invalid_structure'::text;
    return;
  end if;

  select
    coalesce(sum(case when status = 'confirmed' then amount * 100 else 0 end), 0)::bigint,
    coalesce(sum(case when status = 'pending' then amount * 100 else 0 end), 0)::bigint
  into confirmed_total_cents, pending_total_cents
  from public.reservation_payments
  where reservation_id = target_reservation_id
    and agency_id = target_agency_id;

  if confirmed_total_cents >= target_contract_total_cents then
    return query select 'reservation_paid_in_full'::text;
    return;
  end if;

  reportable_remaining_cents := greatest(
    target_contract_total_cents - confirmed_total_cents - pending_total_cents,
    0
  );
  if reportable_remaining_cents = 0 then
    return query select 'pending_covers_balance'::text;
    return;
  end if;
  if target_amount_cents > reportable_remaining_cents then
    return query select 'amount_exceeds_reportable_balance'::text;
    return;
  end if;

  -- The payment and its evidence are created together in this transaction.
  insert into public.reservation_payments (
    id, reservation_id, agency_id, amount, currency, status, method, source,
    reference, paid_at, created_by_user_id, status_changed_by_user_id,
    status_changed_at, submitted_by_customer_account_id, idempotency_key
  ) values (
    target_payment_id, target_reservation_id, target_agency_id,
    target_amount_cents::numeric / 100, target_currency, 'pending', 'transfer',
    'customer', target_reference, target_paid_at, null, null, null,
    target_customer_account_id, target_idempotency_key
  ) on conflict (agency_id, idempotency_key) where idempotency_key is not null do nothing;

  -- A same-key request for another reservation is not serialized by this
  -- reservation lock. The unique index remains the cross-reservation barrier;
  -- after it wins, classify the established payment without consuming capacity.
  if not found then
    select * into existing_payment
    from public.reservation_payments
    where agency_id = target_agency_id
      and idempotency_key = target_idempotency_key;
    if not found
      or existing_payment.reservation_id <> target_reservation_id
      or existing_payment.submitted_by_customer_account_id is distinct from target_customer_account_id
      or existing_payment.amount <> (target_amount_cents::numeric / 100)
      or existing_payment.currency <> target_currency
      or existing_payment.status <> 'pending'
      or existing_payment.method <> 'transfer'
      or existing_payment.source <> 'customer'
      or existing_payment.reference is distinct from target_reference
      or existing_payment.paid_at is distinct from target_paid_at
    then
      return query select 'idempotency_conflict'::text;
      return;
    end if;
    if exists (
      select 1 from public.payment_evidence
      where payment_id = existing_payment.id
        and reservation_id = target_reservation_id
        and agency_id = target_agency_id
    ) then
      return query select 'existing'::text;
      return;
    end if;
    return query select 'invalid_structure'::text;
    return;
  end if;

  insert into public.payment_evidence (
    payment_id, reservation_id, agency_id, storage_path, mime_type,
    file_size_bytes, uploaded_by_user_id
  ) values (
    target_payment_id, target_reservation_id, target_agency_id,
    target_storage_path, target_mime_type, target_file_size_bytes, null
  );

  return query select 'created'::text;
end;
$$;

revoke all on function public.finalize_customer_transfer_payment_atomic(
  uuid, uuid, uuid, uuid, bigint, bigint, text, text, timestamptz, uuid, text, text, bigint
) from public, anon, authenticated;
grant execute on function public.finalize_customer_transfer_payment_atomic(
  uuid, uuid, uuid, uuid, bigint, bigint, text, text, timestamptz, uuid, text, text, bigint
) to service_role;
