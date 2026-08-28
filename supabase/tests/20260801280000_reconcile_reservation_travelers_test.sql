begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

insert into public.agencies (id, slug, name) values
  ('28000000-0000-4000-8000-000000000001', 'traveler-reconcile-a', 'Traveler Reconcile A'),
  ('28000000-0000-4000-8000-000000000002', 'traveler-reconcile-b', 'Traveler Reconcile B');

insert into public.reservation_snapshots (
  id, agency_id, idempotency_key, reservation_code, status, currency, snapshot
) values
  (
    '28000000-0000-4000-8000-000000000101',
    '28000000-0000-4000-8000-000000000001',
    'reconcile-a', 'FT-RECONCILE-A', 'pending', 'MXN',
    '{"id":"FT-RECONCILE-A","occupancy":{"adults":1,"minors":0,"totalTravelers":1},"travelers":{"status":"complete","adults":1,"minors":0,"drafts":[{"id":"trip-4-trip-4-dep-2-adult-1","category":"adult","sequence":1,"fullName":"Alice Example","birthDate":"1992-01-25","completionStatus":"complete"}]}}'::jsonb
  ),
  (
    '28000000-0000-4000-8000-000000000102',
    '28000000-0000-4000-8000-000000000001',
    'reconcile-b', 'FT-RECONCILE-B', 'pending', 'MXN',
    '{"id":"FT-RECONCILE-B","occupancy":{"adults":1,"minors":0,"totalTravelers":1},"travelers":{"status":"complete","adults":1,"minors":0,"drafts":[{"id":"trip-4-trip-4-dep-2-adult-1","category":"adult","sequence":1,"fullName":"Bob Example","birthDate":"1992-01-25","completionStatus":"complete"}]}}'::jsonb
  ),
  (
    '28000000-0000-4000-8000-000000000103',
    '28000000-0000-4000-8000-000000000001',
    'reconcile-c', 'FT-RECONCILE-C', 'pending', 'MXN',
    '{"id":"FT-RECONCILE-C","occupancy":{"adults":1,"minors":0,"totalTravelers":1},"travelers":{"status":"complete","adults":1,"minors":0,"drafts":[{"id":"trip-4-trip-4-dep-2-adult-1","category":"adult","sequence":1,"fullName":"Alice Snapshot","birthDate":"1992-01-25","completionStatus":"complete"}]}}'::jsonb
  );

insert into public.reservation_travelers (
  agency_id, reservation_id, position, traveler_type, first_name, last_name, birth_date, status
) values
  (
    '28000000-0000-4000-8000-000000000001',
    '28000000-0000-4000-8000-000000000102',
    1, 'adult', null, null, null, 'pending'
  ),
  (
    '28000000-0000-4000-8000-000000000001',
    '28000000-0000-4000-8000-000000000103',
    1, 'adult', 'Charlie', 'Canonical', '1990-01-01', 'complete'
  );

select is(
  (select result_status from public.reconcile_reservation_travelers_atomic(
    '28000000-0000-4000-8000-000000000001',
    '28000000-0000-4000-8000-000000000101'
  )),
  'reconciled',
  'missing canonical traveler is created from the same reservation snapshot'
);

select is(
  (select first_name from public.reservation_travelers where reservation_id = '28000000-0000-4000-8000-000000000101' and position = 1),
  'Alice',
  'reservation A receives Alice rather than data from another reservation'
);

select is(
  (select last_name from public.reservation_travelers where reservation_id = '28000000-0000-4000-8000-000000000101' and position = 1),
  'Example',
  'fullName uses the normal materializer split convention'
);

select is(
  (select birth_date::text from public.reservation_travelers where reservation_id = '28000000-0000-4000-8000-000000000101' and position = 1),
  '1992-01-25',
  'valid historical birth date is materialized'
);

select is(
  (select status from public.reservation_travelers where reservation_id = '28000000-0000-4000-8000-000000000101' and position = 1),
  'complete',
  'complete draft creates a complete canonical traveler'
);

select is(
  (select result_status from public.reconcile_reservation_travelers_atomic(
    '28000000-0000-4000-8000-000000000001',
    '28000000-0000-4000-8000-000000000102'
  )),
  'reconciled',
  'a completely empty pending row can be filled'
);

select is(
  (select first_name from public.reservation_travelers where reservation_id = '28000000-0000-4000-8000-000000000102' and position = 1),
  'Bob',
  'reservation B receives only Bob despite an identical historical draft id'
);

select is(
  (select result_status from public.reconcile_reservation_travelers_atomic(
    '28000000-0000-4000-8000-000000000001',
    '28000000-0000-4000-8000-000000000103'
  )),
  'no_action',
  'canonical data prevents overwrite'
);

select is(
  (select first_name || ' ' || last_name from public.reservation_travelers where reservation_id = '28000000-0000-4000-8000-000000000103' and position = 1),
  'Charlie Canonical',
  'existing canonical traveler wins over the historical snapshot'
);

select is(
  (select result_status from public.reconcile_reservation_travelers_atomic(
    '28000000-0000-4000-8000-000000000001',
    '28000000-0000-4000-8000-000000000101'
  )),
  'no_action',
  'retry is idempotent after reconciliation'
);

select is(
  (select count(*)::integer from public.reservation_travelers where reservation_id = '28000000-0000-4000-8000-000000000101'),
  1,
  'retry does not create a second slot'
);

select is(
  (select snapshot #>> '{travelers,drafts,0,fullName}' from public.reservation_snapshots where id = '28000000-0000-4000-8000-000000000101'),
  'Alice Example',
  'the immutable snapshot remains historical input only'
);

select is(
  (select result_status from public.reconcile_reservation_travelers_atomic(
    '28000000-0000-4000-8000-000000000002',
    '28000000-0000-4000-8000-000000000101'
  )),
  'not_found',
  'foreign agency cannot reconcile another agency reservation'
);

select ok(
  not has_function_privilege('authenticated', 'public.reconcile_reservation_travelers_atomic(uuid,uuid)', 'EXECUTE'),
  'authenticated cannot execute traveler reconciliation RPC'
);

select ok(
  has_function_privilege('service_role', 'public.reconcile_reservation_travelers_atomic(uuid,uuid)', 'EXECUTE'),
  'service role can execute traveler reconciliation RPC'
);

select * from finish();

rollback;
