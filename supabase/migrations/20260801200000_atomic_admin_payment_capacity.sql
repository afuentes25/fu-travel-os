-- Administrative payment capacity is serialized per reservation. Contract
-- totals are projected by the server from the immutable snapshot and never
-- accepted from the browser.
create function public.create_manual_reservation_payment_atomic(
  target_agency_id uuid,
  target_reservation_id uuid,
  target_contract_total_cents bigint,
  target_amount_cents bigint,
  target_currency text,
  target_status text,
  target_method text,
  target_reference text,
  target_paid_at timestamptz,
  target_created_by_user_id uuid,
  target_idempotency_key uuid
) returns table (
  result_status text,
  payment_id uuid,
  payment_amount numeric,
  payment_currency text,
  payment_status text,
  payment_method text,
  payment_reference text,
  payment_paid_at timestamptz,
  payment_created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  snapshot_row public.reservation_snapshots%rowtype;
  existing_payment public.reservation_payments%rowtype;
  payment_row public.reservation_payments%rowtype;
  confirmed_total_cents bigint := 0;
  pending_total_cents bigint := 0;
  remaining_cents bigint := 0;
begin
  select * into snapshot_row
  from public.reservation_snapshots
  where id = target_reservation_id and agency_id = target_agency_id
  for update;
  if not found then
    return query select 'not_found'::text, null::uuid, null::numeric, null::text, null::text, null::text, null::text, null::timestamptz, null::timestamptz;
    return;
  end if;

  if target_contract_total_cents <= 0
    or target_amount_cents <= 0
    or target_amount_cents > 999999999999
    or target_currency is null
    or char_length(target_currency) <> 3
    or snapshot_row.currency <> target_currency
    or target_status not in ('pending', 'confirmed')
    or target_method not in ('transfer', 'cash', 'card', 'payment_link', 'other')
    or target_paid_at is null
    or target_created_by_user_id is null
    or target_idempotency_key is null
    or (target_reference is not null and char_length(target_reference) > 120)
  then
    return query select 'invalid_structure'::text, null::uuid, null::numeric, null::text, null::text, null::text, null::text, null::timestamptz, null::timestamptz;
    return;
  end if;

  -- A retry is classified before capacity so it does not consume it twice.
  select * into existing_payment
  from public.reservation_payments
  where agency_id = target_agency_id and idempotency_key = target_idempotency_key;
  if found then
    if existing_payment.reservation_id <> target_reservation_id
      or existing_payment.amount <> (target_amount_cents::numeric / 100)
      or existing_payment.currency <> target_currency
      or existing_payment.status <> target_status
      or existing_payment.method <> target_method
      or existing_payment.source <> 'manual'
      or existing_payment.reference is distinct from target_reference
      or existing_payment.paid_at is distinct from target_paid_at
    then
      return query select 'idempotency_conflict'::text, null::uuid, null::numeric, null::text, null::text, null::text, null::text, null::timestamptz, null::timestamptz;
      return;
    end if;
    return query select 'existing'::text, existing_payment.id, existing_payment.amount, existing_payment.currency, existing_payment.status, existing_payment.method, existing_payment.reference, existing_payment.paid_at, existing_payment.created_at;
    return;
  end if;

  if exists (
    select 1 from public.reservation_payments
    where reservation_id = target_reservation_id
      and agency_id = target_agency_id
      and currency <> target_currency
  ) then
    return query select 'invalid_structure'::text, null::uuid, null::numeric, null::text, null::text, null::text, null::text, null::timestamptz, null::timestamptz;
    return;
  end if;

  select
    coalesce(sum(case when status = 'confirmed' then amount * 100 else 0 end), 0)::bigint,
    coalesce(sum(case when status = 'pending' then amount * 100 else 0 end), 0)::bigint
  into confirmed_total_cents, pending_total_cents
  from public.reservation_payments
  where reservation_id = target_reservation_id and agency_id = target_agency_id;

  if confirmed_total_cents > target_contract_total_cents then
    return query select 'historical_overpayment'::text, null::uuid, null::numeric, null::text, null::text, null::text, null::text, null::timestamptz, null::timestamptz;
    return;
  end if;
  if confirmed_total_cents >= target_contract_total_cents then
    return query select 'reservation_paid_in_full'::text, null::uuid, null::numeric, null::text, null::text, null::text, null::text, null::timestamptz, null::timestamptz;
    return;
  end if;

  if target_status = 'pending' then
    remaining_cents := greatest(target_contract_total_cents - confirmed_total_cents - pending_total_cents, 0);
    if target_amount_cents > remaining_cents then
      return query select 'amount_exceeds_reportable_balance'::text, null::uuid, null::numeric, null::text, null::text, null::text, null::text, null::timestamptz, null::timestamptz;
      return;
    end if;
  else
    remaining_cents := greatest(target_contract_total_cents - confirmed_total_cents, 0);
    if target_amount_cents > remaining_cents then
      return query select 'amount_exceeds_confirmable_balance'::text, null::uuid, null::numeric, null::text, null::text, null::text, null::text, null::timestamptz, null::timestamptz;
      return;
    end if;
  end if;

  insert into public.reservation_payments (
    reservation_id, agency_id, amount, currency, status, method, source,
    reference, paid_at, created_by_user_id, status_changed_by_user_id,
    status_changed_at, idempotency_key
  ) values (
    target_reservation_id, target_agency_id, target_amount_cents::numeric / 100,
    target_currency, target_status, target_method, 'manual', target_reference,
    target_paid_at, target_created_by_user_id, null, null, target_idempotency_key
  ) on conflict (agency_id, idempotency_key) where idempotency_key is not null do nothing
  returning * into payment_row;

  if not found then
    select * into existing_payment
    from public.reservation_payments
    where agency_id = target_agency_id and idempotency_key = target_idempotency_key;
    if not found
      or existing_payment.reservation_id <> target_reservation_id
      or existing_payment.amount <> (target_amount_cents::numeric / 100)
      or existing_payment.currency <> target_currency
      or existing_payment.status <> target_status
      or existing_payment.method <> target_method
      or existing_payment.source <> 'manual'
      or existing_payment.reference is distinct from target_reference
      or existing_payment.paid_at is distinct from target_paid_at
    then
      return query select 'idempotency_conflict'::text, null::uuid, null::numeric, null::text, null::text, null::text, null::text, null::timestamptz, null::timestamptz;
      return;
    end if;
    return query select 'existing'::text, existing_payment.id, existing_payment.amount, existing_payment.currency, existing_payment.status, existing_payment.method, existing_payment.reference, existing_payment.paid_at, existing_payment.created_at;
    return;
  end if;

  return query select 'created'::text, payment_row.id, payment_row.amount, payment_row.currency, payment_row.status, payment_row.method, payment_row.reference, payment_row.paid_at, payment_row.created_at;
end;
$$;

create function public.confirm_reservation_payment_atomic(
  target_agency_id uuid,
  target_reservation_id uuid,
  target_payment_id uuid,
  target_contract_total_cents bigint,
  target_actor_user_id uuid,
  target_changed_at timestamptz
) returns table (result_status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  snapshot_row public.reservation_snapshots%rowtype;
  payment_row public.reservation_payments%rowtype;
  confirmed_total_cents bigint := 0;
begin
  select * into snapshot_row
  from public.reservation_snapshots
  where id = target_reservation_id and agency_id = target_agency_id
  for update;
  if not found then return query select 'not_found'::text; return; end if;

  select * into payment_row
  from public.reservation_payments
  where id = target_payment_id
    and reservation_id = target_reservation_id
    and agency_id = target_agency_id
  for update;
  if not found then return query select 'not_found'::text; return; end if;

  if target_contract_total_cents <= 0
    or target_actor_user_id is null
    or target_changed_at is null
    or payment_row.currency <> snapshot_row.currency
    or exists (
      select 1 from public.reservation_payments
      where reservation_id = target_reservation_id
        and agency_id = target_agency_id
        and currency <> snapshot_row.currency
    )
  then return query select 'invalid_structure'::text; return; end if;

  if payment_row.status <> 'pending' then return query select 'conflict'::text; return; end if;
  if payment_row.source = 'customer' and not exists (
    select 1 from public.payment_evidence
    where payment_id = payment_row.id
      and reservation_id = target_reservation_id
      and agency_id = target_agency_id
  ) then return query select 'evidence_required'::text; return; end if;

  select coalesce(sum(amount * 100), 0)::bigint into confirmed_total_cents
  from public.reservation_payments
  where reservation_id = target_reservation_id
    and agency_id = target_agency_id
    and status = 'confirmed';

  if confirmed_total_cents >= target_contract_total_cents
    or payment_row.amount * 100 > target_contract_total_cents - confirmed_total_cents
  then return query select 'payment_exceeds_remaining_balance'::text; return; end if;

  update public.reservation_payments
  set status = 'confirmed', status_changed_by_user_id = target_actor_user_id,
      status_changed_at = target_changed_at
  where id = target_payment_id and status = 'pending';
  if not found then return query select 'conflict'::text; return; end if;
  return query select 'updated'::text;
end;
$$;

revoke all on function public.create_manual_reservation_payment_atomic(
  uuid, uuid, bigint, bigint, text, text, text, text, timestamptz, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.create_manual_reservation_payment_atomic(
  uuid, uuid, bigint, bigint, text, text, text, text, timestamptz, uuid, uuid
) to service_role;

revoke all on function public.confirm_reservation_payment_atomic(
  uuid, uuid, uuid, bigint, uuid, timestamptz
) from public, anon, authenticated;
grant execute on function public.confirm_reservation_payment_atomic(
  uuid, uuid, uuid, bigint, uuid, timestamptz
) to service_role;
