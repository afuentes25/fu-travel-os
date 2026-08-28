begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

insert into public.agencies (id, slug, name) values
  ('28000000-0000-4000-8000-000000000001', 'traveler-isolation-a', 'Traveler Isolation A'),
  ('28000000-0000-4000-8000-000000000002', 'traveler-isolation-b', 'Traveler Isolation B');

insert into public.reservation_snapshots (
  id,
  agency_id,
  idempotency_key,
  reservation_code,
  status,
  currency,
  snapshot
) values
  (
    '28000000-0000-4000-8000-000000000101',
    '28000000-0000-4000-8000-000000000001',
    'traveler-isolation-a',
    'FT-TRAVELER-A',
    'pending',
    'MXN',
    '{"tour":{"id":"same-tour"},"departure":{"id":"same-departure"},"travelers":{"drafts":[{"id":"same-tour-same-departure-adult-1","fullName":"Historical Alice"}]}}'::jsonb
  ),
  (
    '28000000-0000-4000-8000-000000000102',
    '28000000-0000-4000-8000-000000000001',
    'traveler-isolation-b',
    'FT-TRAVELER-B',
    'pending',
    'MXN',
    '{"tour":{"id":"same-tour"},"departure":{"id":"same-departure"},"travelers":{"drafts":[{"id":"same-tour-same-departure-adult-1","fullName":"Historical Bob"}]}}'::jsonb
  ),
  (
    '28000000-0000-4000-8000-000000000103',
    '28000000-0000-4000-8000-000000000002',
    'traveler-isolation-foreign',
    'FT-TRAVELER-FOREIGN',
    'pending',
    'MXN',
    '{}'::jsonb
  );

insert into public.reservation_travelers (
  id,
  reservation_id,
  agency_id,
  traveler_type,
  position,
  first_name,
  last_name,
  birth_date,
  status
) values
  ('28000000-0000-4000-8000-000000000201', '28000000-0000-4000-8000-000000000101', '28000000-0000-4000-8000-000000000001', 'adult', 1, 'Alice', 'Example', '1990-01-01', 'complete'),
  ('28000000-0000-4000-8000-000000000202', '28000000-0000-4000-8000-000000000102', '28000000-0000-4000-8000-000000000001', 'adult', 1, 'Bob', 'Example', '1991-01-01', 'complete'),
  ('28000000-0000-4000-8000-000000000203', '28000000-0000-4000-8000-000000000103', '28000000-0000-4000-8000-000000000002', 'adult', 1, 'Foreign', 'Example', '1992-01-01', 'complete');

select is(
  (select count(*)::integer from public.reservation_travelers where agency_id = '28000000-0000-4000-8000-000000000001' and reservation_id = '28000000-0000-4000-8000-000000000101'),
  1,
  'reservation A has exactly one scoped traveler'
);

select is(
  (select first_name from public.reservation_travelers where agency_id = '28000000-0000-4000-8000-000000000001' and reservation_id = '28000000-0000-4000-8000-000000000101' and position = 1),
  'Alice',
  'reservation A returns Alice'
);

select is(
  (select first_name from public.reservation_travelers where agency_id = '28000000-0000-4000-8000-000000000001' and reservation_id = '28000000-0000-4000-8000-000000000102' and position = 1),
  'Bob',
  'reservation B returns Bob despite equal tour departure and position'
);

with attempted_cross_update as (
  update public.reservation_travelers
  set first_name = 'Leaked'
  where agency_id = '28000000-0000-4000-8000-000000000001'
    and reservation_id = '28000000-0000-4000-8000-000000000102'
    and id = '28000000-0000-4000-8000-000000000201'
  returning id
)
select is(
  (select count(*)::integer from attempted_cross_update),
  0,
  'traveler A cannot be updated through reservation B scope'
);

select is(
  (select first_name from public.reservation_travelers where id = '28000000-0000-4000-8000-000000000201'),
  'Alice',
  'failed cross-reservation update leaves A unchanged'
);

select is(
  (select count(*)::integer from public.reservation_travelers where agency_id = '28000000-0000-4000-8000-000000000001' and reservation_id = '28000000-0000-4000-8000-000000000103'),
  0,
  'foreign agency reservation cannot be selected through agency A scope'
);

select is(
  (select snapshot #>> '{travelers,drafts,0,fullName}' from public.reservation_snapshots where id = '28000000-0000-4000-8000-000000000102'),
  'Historical Bob',
  'operational traveler changes do not mutate the historical snapshot'
);

select * from finish();

rollback;
