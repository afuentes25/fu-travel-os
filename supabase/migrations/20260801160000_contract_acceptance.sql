create table public.reservation_contract_acceptances (
  id uuid primary key default gen_random_uuid(),
  contract_instance_id uuid not null,
  reservation_id uuid not null,
  agency_id uuid not null,
  contract_document_id uuid not null,
  document_content_sha256 text not null check (document_content_sha256 ~ '^[0-9a-f]{64}$'),
  customer_account_id uuid not null,
  accepted_by_user_id uuid references auth.users(id) on delete set null,
  acceptance_statement_version text not null check (btrim(acceptance_statement_version) <> ''),
  acceptance_statement text not null check (btrim(acceptance_statement) <> ''),
  accepted_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint reservation_contract_acceptances_instance_unique unique (contract_instance_id),
  constraint reservation_contract_acceptances_instance_fk foreign key (contract_instance_id, reservation_id, agency_id)
    references public.reservation_contract_instances (id, reservation_id, agency_id) on delete restrict,
  constraint reservation_contract_acceptances_customer_agency_fk foreign key (customer_account_id, agency_id)
    references public.agency_customer_accounts (id, agency_id) on delete restrict
);

alter table public.reservation_documents
  add constraint reservation_documents_id_instance_reservation_agency_unique
  unique (id, contract_instance_id, reservation_id, agency_id);

alter table public.reservation_contract_acceptances
  add constraint reservation_contract_acceptances_document_fk
  foreign key (contract_document_id, contract_instance_id, reservation_id, agency_id)
  references public.reservation_documents (id, contract_instance_id, reservation_id, agency_id)
  on delete restrict;

create index reservation_contract_acceptances_reservation_agency_idx
  on public.reservation_contract_acceptances (reservation_id, agency_id);

alter table public.reservation_contract_acceptances enable row level security;
create policy reservation_contract_acceptances_select_customer_linked
on public.reservation_contract_acceptances for select to authenticated
using ((select public.has_customer_reservation_access(reservation_id)));
create policy reservation_contract_acceptances_select_agency_members
on public.reservation_contract_acceptances for select to authenticated
using ((select public.has_agency_role(agency_id, array['owner','admin','staff']::text[])));
revoke all on public.reservation_contract_acceptances from public, anon, authenticated;
grant select on public.reservation_contract_acceptances to authenticated;

create function public.accept_reservation_contract(
  target_agency_id uuid, target_reservation_id uuid, target_instance_id uuid,
  target_document_id uuid, target_customer_account_id uuid, target_user_id uuid,
  expected_hash text, statement_version text, statement_text text
) returns table(result_status text, accepted_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp as $$
declare instance_row public.reservation_contract_instances%rowtype; document_row public.reservation_documents%rowtype; primary_count integer; accepted_time timestamptz := now();
begin
  select * into instance_row from public.reservation_contract_instances where id=target_instance_id and reservation_id=target_reservation_id and agency_id=target_agency_id for update;
  if not found then return query select 'not_found'::text, null::timestamptz; return; end if;
  if instance_row.status = 'accepted' then
    if exists (select 1 from public.reservation_contract_acceptances where contract_instance_id=target_instance_id) then return query select 'already_accepted'::text, (select accepted_at from public.reservation_contract_acceptances where contract_instance_id=target_instance_id); else return query select 'invalid_structure'::text, null::timestamptz; end if; return;
  end if;
  if instance_row.status in ('superseded','revoked') then return query select 'contract_unavailable'::text, null::timestamptz; return; end if;
  if instance_row.status <> 'prepared' then return query select 'invalid_structure'::text, null::timestamptz; return; end if;
  select * into document_row from public.reservation_documents where id=target_document_id and contract_instance_id=target_instance_id and reservation_id=target_reservation_id and agency_id=target_agency_id for update;
  if not found or document_row.document_type <> 'contract' or document_row.status <> 'available' or document_row.version <> 1 or document_row.content_sha256 is null or document_row.content_sha256 <> expected_hash then return query select 'invalid_structure'::text, null::timestamptz; return; end if;
  select count(*) into primary_count from public.reservation_customer_access where reservation_id=target_reservation_id and agency_id=target_agency_id and role='primary';
  if primary_count <> 1 or not exists (select 1 from public.reservation_customer_access r join public.agency_customer_accounts c on c.id=r.customer_account_id and c.agency_id=r.agency_id where r.reservation_id=target_reservation_id and r.agency_id=target_agency_id and r.customer_account_id=target_customer_account_id and r.role='primary' and c.user_id=target_user_id and c.status='active') then return query select 'forbidden'::text, null::timestamptz; return; end if;
  insert into public.reservation_contract_acceptances (contract_instance_id,reservation_id,agency_id,contract_document_id,document_content_sha256,customer_account_id,accepted_by_user_id,acceptance_statement_version,acceptance_statement,accepted_at) values (target_instance_id,target_reservation_id,target_agency_id,target_document_id,expected_hash,target_customer_account_id,target_user_id,statement_version,statement_text,accepted_time);
  update public.reservation_contract_instances set status='accepted' where id=target_instance_id and status='prepared';
  if not found then raise exception 'contract transition failed'; end if;
  return query select 'accepted'::text, accepted_time;
end; $$;
revoke all on function public.accept_reservation_contract(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.accept_reservation_contract(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text) to service_role;
