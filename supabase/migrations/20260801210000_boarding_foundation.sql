-- Boarding credentials deliberately store only a hash of the future QR secret.
-- Internal IDs, folios and traveler positions are never credentials.
alter table public.reservation_documents
  add constraint reservation_documents_id_traveler_reservation_agency_unique
  unique (id, reservation_traveler_id, reservation_id, agency_id);

create table public.traveler_boarding_credentials (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  reservation_id uuid not null,
  reservation_traveler_id uuid not null,
  ticket_document_id uuid not null,
  token_sha256 text not null,
  status text not null default 'active',
  issued_by_user_id uuid references auth.users(id) on delete set null,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint traveler_boarding_credentials_token_sha256_check
    check (token_sha256 ~ '^[0-9a-f]{64}$'),
  constraint traveler_boarding_credentials_token_sha256_unique unique (token_sha256),
  constraint traveler_boarding_credentials_status_check check (status in ('active', 'revoked')),
  constraint traveler_boarding_credentials_traveler_fk
    foreign key (reservation_traveler_id, reservation_id, agency_id)
    references public.reservation_travelers (id, reservation_id, agency_id)
    on delete restrict,
  constraint traveler_boarding_credentials_ticket_fk
    foreign key (ticket_document_id, reservation_traveler_id, reservation_id, agency_id)
    references public.reservation_documents (id, reservation_traveler_id, reservation_id, agency_id)
    on delete restrict,
  constraint traveler_boarding_credentials_id_traveler_reservation_agency_unique
    unique (id, reservation_traveler_id, reservation_id, agency_id)
);

create unique index traveler_boarding_credentials_one_active_traveler_unique
  on public.traveler_boarding_credentials (reservation_traveler_id)
  where status = 'active';
create index traveler_boarding_credentials_reservation_idx
  on public.traveler_boarding_credentials (reservation_id, agency_id);
create index traveler_boarding_credentials_ticket_idx
  on public.traveler_boarding_credentials (ticket_document_id);

create trigger traveler_boarding_credentials_set_updated_at
before update on public.traveler_boarding_credentials
for each row execute function public.set_identity_updated_at();

create table public.traveler_boarding_state (
  reservation_traveler_id uuid primary key,
  reservation_id uuid not null,
  agency_id uuid not null,
  status text not null default 'pending',
  checked_in_at timestamptz,
  checked_in_by_user_id uuid references auth.users(id) on delete set null,
  boarded_at timestamptz,
  boarded_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint traveler_boarding_state_traveler_fk
    foreign key (reservation_traveler_id, reservation_id, agency_id)
    references public.reservation_travelers (id, reservation_id, agency_id)
    on delete restrict,
  constraint traveler_boarding_state_status_check check (
    (status = 'pending' and checked_in_at is null and boarded_at is null)
    or (status = 'checked_in' and checked_in_at is not null and boarded_at is null)
    or (status = 'boarded' and checked_in_at is not null and boarded_at is not null)
  )
);

create index traveler_boarding_state_reservation_agency_idx
  on public.traveler_boarding_state (reservation_id, agency_id);

create trigger traveler_boarding_state_set_updated_at
before update on public.traveler_boarding_state
for each row execute function public.set_identity_updated_at();

create table public.traveler_boarding_events (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  reservation_id uuid not null,
  reservation_traveler_id uuid not null,
  boarding_credential_id uuid not null,
  event_type text not null,
  performed_by_user_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint traveler_boarding_events_type_check check (event_type in ('checked_in', 'boarded')),
  constraint traveler_boarding_events_traveler_fk
    foreign key (reservation_traveler_id, reservation_id, agency_id)
    references public.reservation_travelers (id, reservation_id, agency_id)
    on delete restrict,
  constraint traveler_boarding_events_credential_fk
    foreign key (boarding_credential_id, reservation_traveler_id, reservation_id, agency_id)
    references public.traveler_boarding_credentials (id, reservation_traveler_id, reservation_id, agency_id)
    on delete restrict
);

create index traveler_boarding_events_reservation_idx
  on public.traveler_boarding_events (reservation_id, agency_id, occurred_at desc);
create index traveler_boarding_events_traveler_idx
  on public.traveler_boarding_events (reservation_traveler_id, occurred_at desc);

alter table public.traveler_boarding_credentials enable row level security;
alter table public.traveler_boarding_state enable row level security;
alter table public.traveler_boarding_events enable row level security;

create policy traveler_boarding_credentials_select_agency_members
on public.traveler_boarding_credentials for select to authenticated
using ((select public.has_agency_role(agency_id, array['owner', 'admin', 'staff']::text[])));
create policy traveler_boarding_state_select_agency_members
on public.traveler_boarding_state for select to authenticated
using ((select public.has_agency_role(agency_id, array['owner', 'admin', 'staff']::text[])));
create policy traveler_boarding_events_select_agency_members
on public.traveler_boarding_events for select to authenticated
using ((select public.has_agency_role(agency_id, array['owner', 'admin', 'staff']::text[])));

revoke all on table public.traveler_boarding_credentials from public, anon, authenticated;
revoke all on table public.traveler_boarding_state from public, anon, authenticated;
revoke all on table public.traveler_boarding_events from public, anon, authenticated;
grant select on table public.traveler_boarding_credentials to authenticated;
grant select on table public.traveler_boarding_state to authenticated;
grant select on table public.traveler_boarding_events to authenticated;
