create table public.reservation_travelers (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null,
  agency_id uuid not null,
  traveler_type text not null,
  position integer not null,
  first_name text,
  last_name text,
  birth_date date,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservation_travelers_reservation_agency_foreign_key
    foreign key (reservation_id, agency_id)
    references public.reservation_snapshots(id, agency_id)
    on delete cascade,
  constraint reservation_travelers_reservation_position_unique
    unique (reservation_id, position),
  constraint reservation_travelers_position_check
    check (position > 0),
  constraint reservation_travelers_type_check
    check (traveler_type in ('adult', 'minor')),
  constraint reservation_travelers_status_check
    check (status in ('pending', 'complete'))
);

create index reservation_travelers_reservation_agency_idx
  on public.reservation_travelers (reservation_id, agency_id);
create index reservation_travelers_agency_id_idx
  on public.reservation_travelers (agency_id);
create index reservation_travelers_status_idx
  on public.reservation_travelers (status);

create trigger reservation_travelers_set_updated_at
before update on public.reservation_travelers
for each row execute function public.set_identity_updated_at();

alter table public.reservation_travelers enable row level security;

create policy reservation_travelers_select_customer_linked
on public.reservation_travelers
for select
to authenticated
using ((select public.has_customer_reservation_access(reservation_id)));

create policy reservation_travelers_select_agency_members
on public.reservation_travelers
for select
to authenticated
using (
  (select public.has_agency_role(
    agency_id,
    array['owner', 'admin', 'staff']::text[]
  ))
);

revoke all on table public.reservation_travelers from public, anon, authenticated;
grant select on table public.reservation_travelers to authenticated;
