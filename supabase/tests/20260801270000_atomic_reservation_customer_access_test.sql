begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

insert into public.agencies (id, slug, name) values
  ('27000000-0000-4000-8000-000000000001', 'atomic-customer-a', 'Atomic Customer A'),
  ('27000000-0000-4000-8000-000000000002', 'atomic-customer-b', 'Atomic Customer B');

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '27000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'same@example.test', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '27000000-0000-4000-8000-000000000102', 'authenticated', 'authenticated', 'different@example.test', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '27000000-0000-4000-8000-000000000103', 'authenticated', 'authenticated', 'foreign@example.test', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '27000000-0000-4000-8000-000000000104', 'authenticated', 'authenticated', 'failure@example.test', '', now(), now(), now(), '', '', '', '');

select is(
  (
    select customer_link_status
    from public.create_reservation_with_customer_access_atomic(
      '27000000-0000-4000-8000-000000000001',
      'guest-key',
      'FT-ATOMIC-GUEST',
      'pending',
      'MXN',
      '{"id":"FT-ATOMIC-GUEST","idempotencyKey":"guest-key","reservationCode":"FT-ATOMIC-GUEST","createdAt":"2026-08-27T00:00:00.000Z","primaryContact":{"firstName":"Guest","lastName":null,"email":"same@example.test","phone":null}}'::jsonb,
      null
    )
  ),
  'not_authenticated',
  'guest creation stays unlinked'
);

select is(
  (select count(*)::integer from public.reservation_customer_access where agency_id = '27000000-0000-4000-8000-000000000001'),
  0,
  'guest text email never grants access'
);

select is(
  (
    select customer_link_status
    from public.create_reservation_with_customer_access_atomic(
      '27000000-0000-4000-8000-000000000001',
      'mismatch-key',
      'FT-ATOMIC-MISMATCH',
      'pending',
      'MXN',
      '{"id":"FT-ATOMIC-MISMATCH","idempotencyKey":"mismatch-key","reservationCode":"FT-ATOMIC-MISMATCH","createdAt":"2026-08-27T00:01:00.000Z","primaryContact":{"firstName":"Mismatch","lastName":null,"email":"same@example.test","phone":null}}'::jsonb,
      '27000000-0000-4000-8000-000000000102'
    )
  ),
  'email_mismatch',
  'authenticated mismatch stays unlinked'
);

select is(
  (select count(*)::integer from public.reservation_customer_access access_link join public.reservation_snapshots reservation on reservation.id = access_link.reservation_id where reservation.idempotency_key = 'mismatch-key'),
  0,
  'mismatch creates no primary'
);

select is(
  (
    select customer_link_status
    from public.create_reservation_with_customer_access_atomic(
      '27000000-0000-4000-8000-000000000001',
      'same-key',
      'FT-ATOMIC-SAME',
      'pending',
      'MXN',
      '{"id":"FT-ATOMIC-SAME","idempotencyKey":"same-key","reservationCode":"FT-ATOMIC-SAME","createdAt":"2026-08-27T00:02:00.000Z","primaryContact":{"firstName":"Same","lastName":"Customer","email":" SAME@example.test ","phone":"5500000000"}}'::jsonb,
      '27000000-0000-4000-8000-000000000101'
    )
  ),
  'linked',
  'same email creates and links atomically'
);

select is(
  (select count(*)::integer from public.agency_customer_accounts where agency_id = '27000000-0000-4000-8000-000000000001' and user_id = '27000000-0000-4000-8000-000000000101' and status = 'active'),
  1,
  'same email resolves exactly one active account'
);

select is(
  (select count(*)::integer from public.reservation_customer_access access_link join public.reservation_snapshots reservation on reservation.id = access_link.reservation_id where reservation.idempotency_key = 'same-key' and access_link.role = 'primary'),
  1,
  'same email creates exactly one primary'
);

select is(
  (
    select customer_link_status
    from public.create_reservation_with_customer_access_atomic(
      '27000000-0000-4000-8000-000000000001',
      'same-key',
      'FT-IGNORED-CONCURRENT-CODE',
      'pending',
      'MXN',
      '{"id":"FT-IGNORED-CONCURRENT-CODE","idempotencyKey":"same-key","reservationCode":"FT-IGNORED-CONCURRENT-CODE","createdAt":"2026-08-27T00:02:01.000Z","primaryContact":{"firstName":"Same","lastName":"Customer","email":" SAME@example.test ","phone":"5500000000"}}'::jsonb,
      '27000000-0000-4000-8000-000000000101'
    )
  ),
  'already_linked',
  'idempotent retry reuses the existing primary'
);

select is(
  (select count(*)::integer from public.reservation_snapshots where agency_id = '27000000-0000-4000-8000-000000000001' and idempotency_key = 'same-key'),
  1,
  'idempotent retry keeps one reservation'
);

select is(
  (select count(*)::integer from public.reservation_customer_access access_link join public.reservation_snapshots reservation on reservation.id = access_link.reservation_id where reservation.idempotency_key = 'same-key' and access_link.role = 'primary'),
  1,
  'idempotent retry keeps one primary'
);

-- A primary owned by another account is never replaced on an existing row.
insert into public.agency_customer_accounts (agency_id, user_id, status)
values ('27000000-0000-4000-8000-000000000001', '27000000-0000-4000-8000-000000000103', 'active');

select public.create_reservation_with_customer_access_atomic(
  '27000000-0000-4000-8000-000000000001',
  'foreign-key',
  'FT-ATOMIC-FOREIGN',
  'pending',
  'MXN',
  '{"id":"FT-ATOMIC-FOREIGN","idempotencyKey":"foreign-key","reservationCode":"FT-ATOMIC-FOREIGN","createdAt":"2026-08-27T00:03:00.000Z","primaryContact":{"firstName":"Same","lastName":null,"email":"same@example.test","phone":null}}'::jsonb,
  null
);

insert into public.reservation_customer_access (agency_id, reservation_id, customer_account_id, role)
select reservation.agency_id, reservation.id, customer_account.id, 'primary'
from public.reservation_snapshots reservation
join public.agency_customer_accounts customer_account
  on customer_account.agency_id = reservation.agency_id
 and customer_account.user_id = '27000000-0000-4000-8000-000000000103'
where reservation.idempotency_key = 'foreign-key';

select is(
  (
    select result_status
    from public.create_reservation_with_customer_access_atomic(
      '27000000-0000-4000-8000-000000000001',
      'foreign-key',
      'FT-ATOMIC-FOREIGN',
      'pending',
      'MXN',
      '{"id":"FT-ATOMIC-FOREIGN","idempotencyKey":"foreign-key","reservationCode":"FT-ATOMIC-FOREIGN","createdAt":"2026-08-27T00:03:00.000Z","primaryContact":{"firstName":"Same","lastName":null,"email":"same@example.test","phone":null}}'::jsonb,
      '27000000-0000-4000-8000-000000000101'
    )
  ),
  'reservation_already_claimed',
  'a foreign primary is not replaced'
);

select is(
  (select customer_account.user_id::text from public.reservation_customer_access access_link join public.reservation_snapshots reservation on reservation.id = access_link.reservation_id join public.agency_customer_accounts customer_account on customer_account.id = access_link.customer_account_id where reservation.idempotency_key = 'foreign-key' and access_link.role = 'primary'),
  '27000000-0000-4000-8000-000000000103',
  'foreign primary ownership remains unchanged'
);

-- An orphaned guest snapshot can be repaired only by the separate maintenance RPC.
insert into public.agency_customer_accounts (agency_id, user_id, status)
values ('27000000-0000-4000-8000-000000000002', '27000000-0000-4000-8000-000000000101', 'active');

select public.create_reservation_with_customer_access_atomic(
  '27000000-0000-4000-8000-000000000002',
  'orphan-key',
  'FT-ATOMIC-ORPHAN',
  'pending',
  'MXN',
  '{"id":"FT-ATOMIC-ORPHAN","idempotencyKey":"orphan-key","reservationCode":"FT-ATOMIC-ORPHAN","createdAt":"2026-08-27T00:04:00.000Z","primaryContact":{"firstName":"Same","lastName":null,"email":"same@example.test","phone":null}}'::jsonb,
  null
);

select is(
  (
    select result_status
    from public.reconcile_orphan_customer_access_atomic(
      '27000000-0000-4000-8000-000000000002',
      (select id from public.reservation_snapshots where idempotency_key = 'orphan-key'),
      '27000000-0000-4000-8000-000000000101'
    )
  ),
  'linked',
  'explicit orphan reconciliation creates primary'
);

select is(
  (
    select result_status
    from public.reconcile_orphan_customer_access_atomic(
      '27000000-0000-4000-8000-000000000002',
      (select id from public.reservation_snapshots where idempotency_key = 'orphan-key'),
      '27000000-0000-4000-8000-000000000101'
    )
  ),
  'already_linked',
  'orphan reconciliation retry is idempotent'
);

-- Force the access insert to fail and prove the newly inserted snapshot rolls back.
create function pg_temp.force_primary_failure()
returns trigger
language plpgsql
as $$
begin
  if new.agency_id = '27000000-0000-4000-8000-000000000002' then
    raise exception 'forced_primary_failure';
  end if;
  return new;
end;
$$;

create trigger force_primary_failure
before insert on public.reservation_customer_access
for each row execute function pg_temp.force_primary_failure();

create temp table atomic_failure_capture(message text);

do $$
begin
  perform public.create_reservation_with_customer_access_atomic(
    '27000000-0000-4000-8000-000000000002',
    'forced-failure-key',
    'FT-ATOMIC-FAILURE',
    'pending',
    'MXN',
    '{"id":"FT-ATOMIC-FAILURE","idempotencyKey":"forced-failure-key","reservationCode":"FT-ATOMIC-FAILURE","createdAt":"2026-08-27T00:05:00.000Z","primaryContact":{"firstName":"Failure","lastName":null,"email":"failure@example.test","phone":null}}'::jsonb,
    '27000000-0000-4000-8000-000000000104'
  );
exception when others then
  insert into atomic_failure_capture values (sqlerrm);
end;
$$;

drop trigger force_primary_failure on public.reservation_customer_access;

select is(
  (select message from atomic_failure_capture),
  'forced_primary_failure',
  'primary insert failure is observed'
);

select is(
  (select count(*)::integer from public.reservation_snapshots where idempotency_key = 'forced-failure-key'),
  0,
  'primary insert failure rolls back the new reservation'
);

select ok(
  has_function_privilege('service_role', 'public.create_reservation_with_customer_access_atomic(uuid,text,text,text,text,jsonb,uuid)', 'EXECUTE'),
  'service role can execute create RPC'
);

select ok(
  not has_function_privilege('authenticated', 'public.create_reservation_with_customer_access_atomic(uuid,text,text,text,text,jsonb,uuid)', 'EXECUTE'),
  'authenticated cannot execute create RPC'
);

select ok(
  not has_function_privilege('anon', 'public.reconcile_orphan_customer_access_atomic(uuid,uuid,uuid)', 'EXECUTE'),
  'anon cannot execute reconciliation RPC'
);

select ok(
  has_function_privilege('service_role', 'public.reconcile_orphan_customer_access_atomic(uuid,uuid,uuid)', 'EXECUTE'),
  'service role can execute reconciliation RPC'
);

select * from finish();

rollback;
