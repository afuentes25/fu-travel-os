alter table public.agency_contract_templates
  add constraint agency_contract_templates_id_agency_unique unique (id, agency_id);

create table public.reservation_contract_instances (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null,
  agency_id uuid not null,
  contract_template_id uuid not null,
  contract_template_version integer not null,
  status text not null default 'prepared',
  legal_profile_snapshot jsonb not null,
  contract_content_snapshot jsonb not null,
  prepared_by_user_id uuid references auth.users(id) on delete set null,
  prepared_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint reservation_contract_instances_reservation_agency_fk foreign key (reservation_id, agency_id) references public.reservation_snapshots(id, agency_id) on delete cascade,
  constraint reservation_contract_instances_template_agency_fk foreign key (contract_template_id, agency_id) references public.agency_contract_templates(id, agency_id) on delete restrict,
  constraint reservation_contract_instances_version_check check (contract_template_version > 0),
  constraint reservation_contract_instances_status_check check (status in ('prepared', 'accepted', 'superseded', 'revoked')),
  constraint reservation_contract_instances_legal_snapshot_check check (legal_profile_snapshot ? 'legalName' and jsonb_typeof(legal_profile_snapshot) = 'object'),
  constraint reservation_contract_instances_content_snapshot_check check (contract_content_snapshot ? 'templateVersion' and contract_content_snapshot ? 'termsText' and jsonb_typeof(contract_content_snapshot) = 'object')
);

create unique index reservation_contract_instances_one_current_unique
  on public.reservation_contract_instances (reservation_id)
  where status in ('prepared', 'accepted');

create index reservation_contract_instances_reservation_agency_idx on public.reservation_contract_instances (reservation_id, agency_id);

create function public.prevent_reservation_contract_instance_context_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.reservation_id is distinct from old.reservation_id
    or new.agency_id is distinct from old.agency_id
    or new.contract_template_id is distinct from old.contract_template_id
    or new.contract_template_version is distinct from old.contract_template_version
    or new.legal_profile_snapshot is distinct from old.legal_profile_snapshot
    or new.contract_content_snapshot is distinct from old.contract_content_snapshot
    or new.prepared_by_user_id is distinct from old.prepared_by_user_id
    or new.prepared_at is distinct from old.prepared_at then
    raise exception 'reservation contract instance context is immutable';
  end if;
  return new;
end;
$$;

create trigger reservation_contract_instances_context_immutable
before update on public.reservation_contract_instances
for each row execute function public.prevent_reservation_contract_instance_context_update();

alter table public.reservation_contract_instances enable row level security;
create policy reservation_contract_instances_select_customer_linked on public.reservation_contract_instances for select to authenticated using ((select public.has_customer_reservation_access(reservation_id)));
create policy reservation_contract_instances_select_agency_members on public.reservation_contract_instances for select to authenticated using ((select public.has_agency_role(agency_id, array['owner','admin','staff']::text[])));
revoke all on table public.reservation_contract_instances from public, anon, authenticated;
grant select on table public.reservation_contract_instances to authenticated;
revoke all on function public.prevent_reservation_contract_instance_context_update() from public, anon, authenticated;
