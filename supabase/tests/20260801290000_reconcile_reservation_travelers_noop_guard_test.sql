begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

insert into public.agencies (id, slug, name) values
  ('29000000-0000-4000-8000-000000000001', 'traveler-noop-a', 'Traveler Noop A');

insert into public.reservation_snapshots (
  id, agency_id, idempotency_key, reservation_code, status, currency, snapshot
) values
  (
    '29000000-0000-4000-8000-000000000101',
    '29000000-0000-4000-8000-000000000001',
    'noop-existing', 'FT-NOOP-EXISTING', 'pending', 'MXN',
    '{"id":"FT-NOOP-EXISTING","occupancy":{"adults":1,"minors":0,"totalTravelers":1},"travelers":{"status":"pending","adults":1,"minors":0,"drafts":[{"id":"trip-4-trip-4-dep-2-adult-1","category":"adult","sequence":1,"fullName":"","completionStatus":"pending"}]}}'::jsonb
  ),
  (
    '29000000-0000-4000-8000-000000000102',
    '29000000-0000-4000-8000-000000000001',
    'noop-missing', 'FT-NOOP-MISSING', 'pending', 'MXN',
    '{"id":"FT-NOOP-MISSING","occupancy":{"adults":1,"minors":0,"totalTravelers":1},"travelers":{"status":"pending","adults":1,"minors":0,"drafts":[{"id":"trip-4-trip-4-dep-2-adult-1","category":"adult","sequence":1,"fullName":"","completionStatus":"pending"}]}}'::jsonb
  ),
  (
    '29000000-0000-4000-8000-000000000103',
    '29000000-0000-4000-8000-000000000001',
    'noop-data', 'FT-NOOP-DATA', 'pending', 'MXN',
    '{"id":"FT-NOOP-DATA","occupancy":{"adults":1,"minors":0,"totalTravelers":1},"travelers":{"status":"complete","adults":1,"minors":0,"drafts":[{"id":"trip-4-trip-4-dep-2-adult-1","category":"adult","sequence":1,"fullName":"Angel Fuentes","birthDate":"1992-01-25","completionStatus":"complete"}]}}'::jsonb
  );

insert into public.reservation_travelers (
  agency_id, reservation_id, position, traveler_type, first_name, last_name, birth_date, status, updated_at
) values
  (
    '29000000-0000-4000-8000-000000000001',
    '29000000-0000-4000-8000-000000000101',
    1, 'adult', null, null, null, 'pending', '2026-08-29T00:00:00.000Z'
  ),
  (
    '29000000-0000-4000-8000-000000000001',
    '29000000-0000-4000-8000-000000000103',
    1, 'adult', null, null, null, 'pending', '2026-08-29T00:00:00.000Z'
  );

select is(
  (select result_status from public.reconcile_reservation_travelers_atomic(
    '29000000-0000-4000-8000-000000000001',
    '29000000-0000-4000-8000-000000000101'
  )),
  'no_action',
  'empty pending draft leaves an existing empty pending row alone'
);

select is(
  (select updated_at::text from public.reservation_travelers where reservation_id = '29000000-0000-4000-8000-000000000101' and position = 1),
  '2026-08-29 00:00:00+00',
  'no-op reconciliation does not change updated_at'
);

select is(
  (select result_status from public.reconcile_reservation_travelers_atomic(
    '29000000-0000-4000-8000-000000000001',
    '29000000-0000-4000-8000-000000000101'
  )),
  'no_action',
  'a second empty-draft reconciliation remains a no-op'
);

select is(
  (select result_status from public.reconcile_reservation_travelers_atomic(
    '29000000-0000-4000-8000-000000000001',
    '29000000-0000-4000-8000-000000000102'
  )),
  'reconciled',
  'a missing slot is still created even when its draft is pending and empty'
);

select is(
  (select status from public.reservation_travelers where reservation_id = '29000000-0000-4000-8000-000000000102' and position = 1),
  'pending',
  'missing empty draft creates the required pending operational slot'
);

select is(
  (select result_status from public.reconcile_reservation_travelers_atomic(
    '29000000-0000-4000-8000-000000000001',
    '29000000-0000-4000-8000-000000000103'
  )),
  'reconciled',
  'an existing empty row is updated when its own draft has materializable data'
);

select is(
  (select first_name || ' ' || last_name from public.reservation_travelers where reservation_id = '29000000-0000-4000-8000-000000000103' and position = 1),
  'Angel Fuentes',
  'materializable name data reaches the canonical row'
);

select is(
  (select birth_date::text from public.reservation_travelers where reservation_id = '29000000-0000-4000-8000-000000000103' and position = 1),
  '1992-01-25',
  'materializable birth date reaches the canonical row'
);

select * from finish();

rollback;
