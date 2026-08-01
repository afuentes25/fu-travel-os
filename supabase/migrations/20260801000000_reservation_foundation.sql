create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.reservation_snapshots (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  idempotency_key text not null,
  reservation_code text not null,
  status text not null,
  currency text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint reservation_snapshots_agency_idempotency_key_unique
    unique (agency_id, idempotency_key),
  constraint reservation_snapshots_agency_reservation_code_unique
    unique (agency_id, reservation_code)
);

create index reservation_snapshots_agency_id_idx
  on public.reservation_snapshots (agency_id);
create index reservation_snapshots_created_at_idx
  on public.reservation_snapshots (created_at desc);
create index reservation_snapshots_status_idx
  on public.reservation_snapshots (status);

alter table public.agencies enable row level security;
alter table public.reservation_snapshots enable row level security;

-- Browser roles receive no direct access; future server endpoints use the
-- server-only service role after validating tenant context and idempotency.
revoke all on table public.agencies from anon, authenticated;
revoke all on table public.reservation_snapshots from anon, authenticated;

create function public.prevent_reservation_snapshot_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Reservation snapshots are immutable';
end;
$$;

create trigger reservation_snapshots_immutable
before update or delete on public.reservation_snapshots
for each row execute function public.prevent_reservation_snapshot_mutation();
