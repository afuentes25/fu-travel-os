-- Legal identity and contractual terms remain agency-scoped configuration.
-- Concrete contracts will later materialize this configuration with a reservation.
create table public.agency_legal_profiles (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  legal_name text not null,
  tax_id text,
  legal_address text,
  support_email text,
  support_phone text,
  jurisdiction text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agency_legal_profiles_agency_unique unique (agency_id),
  constraint agency_legal_profiles_legal_name_check check (btrim(legal_name) <> '')
);

create table public.agency_contract_templates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  version integer not null,
  status text not null default 'draft',
  title text not null,
  introductory_text text,
  terms_text text not null,
  payment_policy_text text,
  cancellation_policy_text text,
  traveler_responsibility_text text,
  jurisdiction_text text,
  effective_from timestamptz,
  activated_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agency_contract_templates_agency_version_unique unique (agency_id, version),
  constraint agency_contract_templates_version_positive_check check (version > 0),
  constraint agency_contract_templates_status_check check (status in ('draft', 'active', 'retired')),
  constraint agency_contract_templates_title_check check (btrim(title) <> ''),
  constraint agency_contract_templates_terms_check check (btrim(terms_text) <> '')
);

-- An agency can activate only one template for future contracts at a time.
create unique index agency_contract_templates_one_active_per_agency_unique
  on public.agency_contract_templates (agency_id)
  where status = 'active';

create index agency_contract_templates_agency_id_idx
  on public.agency_contract_templates (agency_id);
create index agency_contract_templates_status_idx
  on public.agency_contract_templates (status);
create index agency_contract_templates_effective_from_idx
  on public.agency_contract_templates (effective_from);

create trigger agency_legal_profiles_set_updated_at
before update on public.agency_legal_profiles
for each row execute function public.set_identity_updated_at();

create trigger agency_contract_templates_set_updated_at
before update on public.agency_contract_templates
for each row execute function public.set_identity_updated_at();

alter table public.agency_legal_profiles enable row level security;
alter table public.agency_contract_templates enable row level security;

create policy agency_legal_profiles_select_agency_members
on public.agency_legal_profiles
for select
to authenticated
using (
  (select public.has_agency_role(
    agency_id,
    array['owner', 'admin', 'staff']::text[]
  ))
);

create policy agency_contract_templates_select_agency_members
on public.agency_contract_templates
for select
to authenticated
using (
  (select public.has_agency_role(
    agency_id,
    array['owner', 'admin', 'staff']::text[]
  ))
);

-- Browser clients may read only through the policies above. Future writes use
-- authorized server-side commands and must preserve template history.
revoke all on table public.agency_legal_profiles from public, anon, authenticated;
revoke all on table public.agency_contract_templates from public, anon, authenticated;
grant select on table public.agency_legal_profiles to authenticated;
grant select on table public.agency_contract_templates to authenticated;
