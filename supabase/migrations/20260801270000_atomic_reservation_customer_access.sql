-- A reservation created for a verified, matching customer identity must never
-- commit without its primary access. Guest reservations and authenticated
-- reservations whose booking email differs remain valid and unlinked.
create function public.create_reservation_with_customer_access_atomic(
  target_agency_id uuid,
  target_idempotency_key text,
  target_reservation_code text,
  target_status text,
  target_currency text,
  target_snapshot jsonb,
  target_verified_auth_user_id uuid default null
)
returns table (
  result_status text,
  reservation_row_id uuid,
  reservation_code text,
  reservation_status text,
  reservation_currency text,
  reservation_snapshot jsonb,
  reservation_created_at timestamptz,
  customer_link_status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  snapshot_row public.reservation_snapshots%rowtype;
  reservation_was_created boolean := false;
  booking_email text;
  authenticated_email text;
  customer_account_row public.agency_customer_accounts%rowtype;
  existing_primary_account_id uuid;
  existing_customer_access_id uuid;
  existing_customer_access_role text;
  primary_count integer;
begin
  if target_agency_id is null
    or nullif(btrim(target_idempotency_key), '') is null
    or nullif(btrim(target_reservation_code), '') is null
    or nullif(btrim(target_status), '') is null
    or nullif(btrim(target_currency), '') is null
    or target_snapshot is null
    or jsonb_typeof(target_snapshot) <> 'object'
    or target_snapshot ->> 'idempotencyKey' is distinct from target_idempotency_key
    or target_snapshot ->> 'reservationCode' is distinct from target_reservation_code
    or not exists (select 1 from public.agencies where id = target_agency_id) then
    return query
      select 'invalid_structure'::text, null::uuid, null::text, null::text,
        null::text, null::jsonb, null::timestamptz, null::text;
    return;
  end if;

  -- Auth identity is verified by the server before it reaches this private
  -- function. The database still obtains the authoritative login email from
  -- auth.users and compares it with the immutable booking contact.
  if target_verified_auth_user_id is not null then
    select lower(btrim(auth_user.email))
      into authenticated_email
    from auth.users as auth_user
    where auth_user.id = target_verified_auth_user_id;

    if not found or nullif(authenticated_email, '') is null then
      raise exception using errcode = 'P0001', message = 'auth_identity_failed';
    end if;

    booking_email := lower(btrim(target_snapshot #>> '{primaryContact,email}'));

    if nullif(booking_email, '') is not null
      and booking_email = authenticated_email then
      select customer_account.*
        into customer_account_row
      from public.agency_customer_accounts as customer_account
      where customer_account.agency_id = target_agency_id
        and customer_account.user_id = target_verified_auth_user_id
      for update;

      if found and customer_account_row.status <> 'active' then
        raise exception using errcode = 'P0001', message = 'customer_account_failed';
      end if;
    end if;
  end if;

  select reservation.*
    into snapshot_row
  from public.reservation_snapshots as reservation
  where reservation.agency_id = target_agency_id
    and reservation.idempotency_key = target_idempotency_key
  for update;

  if not found then
    insert into public.reservation_snapshots (
      agency_id,
      idempotency_key,
      reservation_code,
      status,
      currency,
      snapshot
    ) values (
      target_agency_id,
      target_idempotency_key,
      target_reservation_code,
      target_status,
      target_currency,
      target_snapshot
    )
    on conflict (agency_id, idempotency_key) do nothing
    returning * into snapshot_row;

    if found then
      reservation_was_created := true;
    else
      select reservation.*
        into snapshot_row
      from public.reservation_snapshots as reservation
      where reservation.agency_id = target_agency_id
        and reservation.idempotency_key = target_idempotency_key
      for update;

      if not found then
        raise exception using errcode = 'P0001', message = 'reservation_create_failed';
      end if;
    end if;
  end if;

  -- Server-generated folio and timestamp may differ between two truly
  -- concurrent executions of the same idempotent request. They are not part of
  -- the customer's business payload and therefore do not create a conflict.
  if snapshot_row.status is distinct from target_status
    or snapshot_row.currency is distinct from target_currency
    or (snapshot_row.snapshot - 'id' - 'reservationCode' - 'createdAt')
      is distinct from (target_snapshot - 'id' - 'reservationCode' - 'createdAt') then
    return query
      select 'idempotency_conflict'::text, snapshot_row.id,
        snapshot_row.reservation_code, snapshot_row.status,
        snapshot_row.currency, snapshot_row.snapshot, snapshot_row.created_at,
        null::text;
    return;
  end if;

  if target_verified_auth_user_id is null then
    return query
      select case when reservation_was_created then 'created' else 'existing' end,
        snapshot_row.id, snapshot_row.reservation_code, snapshot_row.status,
        snapshot_row.currency, snapshot_row.snapshot, snapshot_row.created_at,
        'not_authenticated'::text;
    return;
  end if;

  booking_email := lower(btrim(snapshot_row.snapshot #>> '{primaryContact,email}'));
  if nullif(booking_email, '') is null or booking_email <> authenticated_email then
    return query
      select case when reservation_was_created then 'created' else 'existing' end,
        snapshot_row.id, snapshot_row.reservation_code, snapshot_row.status,
        snapshot_row.currency, snapshot_row.snapshot, snapshot_row.created_at,
        'email_mismatch'::text;
    return;
  end if;

  if customer_account_row.id is null then
    insert into public.agency_customer_accounts (
      agency_id,
      user_id,
      status,
      first_name,
      last_name,
      phone
    ) values (
      target_agency_id,
      target_verified_auth_user_id,
      'active',
      nullif(btrim(snapshot_row.snapshot #>> '{primaryContact,firstName}'), ''),
      nullif(btrim(snapshot_row.snapshot #>> '{primaryContact,lastName}'), ''),
      nullif(btrim(snapshot_row.snapshot #>> '{primaryContact,phone}'), '')
    )
    on conflict (agency_id, user_id) do nothing;

    select customer_account.*
      into customer_account_row
    from public.agency_customer_accounts as customer_account
    where customer_account.agency_id = target_agency_id
      and customer_account.user_id = target_verified_auth_user_id
    for update;

    if not found or customer_account_row.status <> 'active' then
      raise exception using errcode = 'P0001', message = 'customer_account_failed';
    end if;
  end if;

  select access_link.customer_account_id
    into existing_primary_account_id
  from public.reservation_customer_access as access_link
  where access_link.agency_id = target_agency_id
    and access_link.reservation_id = snapshot_row.id
    and access_link.role = 'primary'
  for update;

  if found then
    if existing_primary_account_id = customer_account_row.id then
      return query
        select case when reservation_was_created then 'created' else 'existing' end,
          snapshot_row.id, snapshot_row.reservation_code, snapshot_row.status,
          snapshot_row.currency, snapshot_row.snapshot, snapshot_row.created_at,
          'already_linked'::text;
      return;
    end if;

    if reservation_was_created then
      raise exception using errcode = 'P0001', message = 'reservation_already_claimed';
    end if;

    return query
      select 'reservation_already_claimed'::text, snapshot_row.id,
        snapshot_row.reservation_code, snapshot_row.status,
        snapshot_row.currency, snapshot_row.snapshot, snapshot_row.created_at,
        null::text;
    return;
  end if;

  select access_link.id, access_link.role
    into existing_customer_access_id, existing_customer_access_role
  from public.reservation_customer_access as access_link
  where access_link.agency_id = target_agency_id
    and access_link.reservation_id = snapshot_row.id
    and access_link.customer_account_id = customer_account_row.id
  for update;

  if found then
    if existing_customer_access_role <> 'primary' then
      update public.reservation_customer_access
      set role = 'primary'
      where id = existing_customer_access_id;
    end if;
  else
    insert into public.reservation_customer_access (
      agency_id,
      reservation_id,
      customer_account_id,
      role
    ) values (
      target_agency_id,
      snapshot_row.id,
      customer_account_row.id,
      'primary'
    );
  end if;

  select count(*)::integer
    into primary_count
  from public.reservation_customer_access as access_link
  where access_link.agency_id = target_agency_id
    and access_link.reservation_id = snapshot_row.id
    and access_link.role = 'primary'
    and access_link.customer_account_id = customer_account_row.id;

  if primary_count <> 1 then
    raise exception using errcode = 'P0001', message = 'primary_access_failed';
  end if;

  return query
    select case when reservation_was_created then 'created' else 'existing' end,
      snapshot_row.id, snapshot_row.reservation_code, snapshot_row.status,
      snapshot_row.currency, snapshot_row.snapshot, snapshot_row.created_at,
      'linked'::text;
end;
$$;

create function public.reconcile_orphan_customer_access_atomic(
  target_agency_id uuid,
  target_reservation_id uuid,
  target_verified_auth_user_id uuid
)
returns table (result_status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  snapshot_row public.reservation_snapshots%rowtype;
  booking_email text;
  authenticated_email text;
  matching_auth_users integer;
  customer_account_row public.agency_customer_accounts%rowtype;
  existing_primary_account_id uuid;
  existing_access_count integer;
begin
  select reservation.*
    into snapshot_row
  from public.reservation_snapshots as reservation
  where reservation.id = target_reservation_id
    and reservation.agency_id = target_agency_id
  for update;

  if not found then
    return query select 'not_found'::text;
    return;
  end if;

  booking_email := lower(btrim(snapshot_row.snapshot #>> '{primaryContact,email}'));
  if nullif(booking_email, '') is null then
    return query select 'not_eligible'::text;
    return;
  end if;

  select count(*)::integer
    into matching_auth_users
  from auth.users as auth_user
  where lower(btrim(auth_user.email)) = booking_email;

  select lower(btrim(auth_user.email))
    into authenticated_email
  from auth.users as auth_user
  where auth_user.id = target_verified_auth_user_id;

  if matching_auth_users <> 1
    or not found
    or authenticated_email is distinct from booking_email then
    return query select 'not_eligible'::text;
    return;
  end if;

  select customer_account.*
    into customer_account_row
  from public.agency_customer_accounts as customer_account
  where customer_account.agency_id = target_agency_id
    and customer_account.user_id = target_verified_auth_user_id
  for update;

  if not found or customer_account_row.status <> 'active' then
    return query select 'account_unavailable'::text;
    return;
  end if;

  select access_link.customer_account_id
    into existing_primary_account_id
  from public.reservation_customer_access as access_link
  where access_link.agency_id = target_agency_id
    and access_link.reservation_id = target_reservation_id
    and access_link.role = 'primary'
  for update;

  if found then
    return query select case
      when existing_primary_account_id = customer_account_row.id
        then 'already_linked'::text
      else 'reservation_already_claimed'::text
    end;
    return;
  end if;

  select count(*)::integer
    into existing_access_count
  from public.reservation_customer_access as access_link
  where access_link.agency_id = target_agency_id
    and access_link.reservation_id = target_reservation_id;

  if existing_access_count <> 0 then
    return query select 'not_eligible'::text;
    return;
  end if;

  insert into public.reservation_customer_access (
    agency_id,
    reservation_id,
    customer_account_id,
    role
  ) values (
    target_agency_id,
    target_reservation_id,
    customer_account_row.id,
    'primary'
  );

  return query select 'linked'::text;
end;
$$;

revoke all on function public.create_reservation_with_customer_access_atomic(
  uuid, text, text, text, text, jsonb, uuid
) from public, anon, authenticated;

grant execute on function public.create_reservation_with_customer_access_atomic(
  uuid, text, text, text, text, jsonb, uuid
) to service_role;

revoke all on function public.reconcile_orphan_customer_access_atomic(
  uuid, uuid, uuid
) from public, anon, authenticated;

grant execute on function public.reconcile_orphan_customer_access_atomic(
  uuid, uuid, uuid
) to service_role;
