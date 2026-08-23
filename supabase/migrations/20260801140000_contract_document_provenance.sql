-- Contract provenance is optional for existing and non-contract documents.
alter table public.reservation_contract_instances
  add constraint reservation_contract_instances_id_reservation_agency_unique
  unique (id, reservation_id, agency_id);

alter table public.reservation_documents
  add column contract_instance_id uuid;

alter table public.reservation_documents
  add constraint reservation_documents_contract_instance_fk
  foreign key (contract_instance_id, reservation_id, agency_id)
  references public.reservation_contract_instances (id, reservation_id, agency_id)
  on delete restrict;

alter table public.reservation_documents
  add constraint reservation_documents_contract_instance_consistency_check
  check (
    (document_type = 'contract' and contract_instance_id is not null)
    or document_type <> 'contract'
  );

-- A contractual instance can have one document per explicit version, while
-- superseded/revoked history and future versions remain representable.
create unique index reservation_documents_contract_instance_version_unique
  on public.reservation_documents (contract_instance_id, version)
  where document_type = 'contract'
    and contract_instance_id is not null;
