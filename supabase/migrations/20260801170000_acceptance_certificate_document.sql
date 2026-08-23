-- Extend the existing document allowlist without changing any other document rules.
alter table public.reservation_documents
  drop constraint reservation_documents_type_check;

alter table public.reservation_documents
  add constraint reservation_documents_type_check
  check (document_type in ('payment_receipt', 'contract', 'acceptance_certificate', 'voucher', 'ticket'));

alter table public.reservation_documents
  add column contract_acceptance_id uuid;

alter table public.reservation_contract_acceptances
  add constraint reservation_contract_acceptances_id_instance_reservation_agency_unique
  unique (id, contract_instance_id, reservation_id, agency_id);

alter table public.reservation_documents
  add constraint reservation_documents_contract_acceptance_fk
  foreign key (contract_acceptance_id, contract_instance_id, reservation_id, agency_id)
  references public.reservation_contract_acceptances (id, contract_instance_id, reservation_id, agency_id)
  on delete restrict;

alter table public.reservation_documents
  add constraint reservation_documents_acceptance_consistency_check
  check (
    (
      document_type = 'acceptance_certificate'
      and contract_acceptance_id is not null
      and contract_instance_id is not null
      and payment_id is null
    )
    or (
      document_type = 'contract'
      and contract_instance_id is not null
      and contract_acceptance_id is null
      and payment_id is null
    )
    or (
      document_type = 'payment_receipt'
      and contract_acceptance_id is null
    )
    or document_type in ('voucher', 'ticket')
  );

create unique index reservation_documents_acceptance_version_unique
  on public.reservation_documents (contract_acceptance_id, version)
  where document_type = 'acceptance_certificate'
    and contract_acceptance_id is not null;
