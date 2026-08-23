-- Tickets are the only reservation document tied to an individual traveler.
alter table public.reservation_documents
  add column reservation_traveler_id uuid;

-- reservation_travelers already has reservation/position uniqueness; this
-- additional key makes the tenant-safe composite reference possible.
alter table public.reservation_travelers
  add constraint reservation_travelers_id_reservation_agency_unique
  unique (id, reservation_id, agency_id);

alter table public.reservation_documents
  add constraint reservation_documents_traveler_reservation_agency_fk
  foreign key (reservation_traveler_id, reservation_id, agency_id)
  references public.reservation_travelers (id, reservation_id, agency_id)
  on delete restrict;

-- Replace the centralized provenance rule so every current document type has
-- an explicit traveler relationship policy.
alter table public.reservation_documents
  drop constraint reservation_documents_acceptance_consistency_check;

alter table public.reservation_documents
  add constraint reservation_documents_provenance_consistency_check
  check (
    (
      document_type = 'acceptance_certificate'
      and contract_acceptance_id is not null
      and contract_instance_id is not null
      and reservation_traveler_id is null
      and payment_id is null
    )
    or (
      document_type = 'contract'
      and contract_instance_id is not null
      and contract_acceptance_id is null
      and reservation_traveler_id is null
      and payment_id is null
    )
    or (
      document_type = 'payment_receipt'
      and contract_acceptance_id is null
      and reservation_traveler_id is null
    )
    or (
      document_type = 'voucher'
      and contract_acceptance_id is null
      and contract_instance_id is null
      and reservation_traveler_id is null
    )
    or (
      document_type = 'ticket'
      and contract_acceptance_id is null
      and contract_instance_id is null
      and reservation_traveler_id is not null
    )
  );

create unique index reservation_documents_ticket_traveler_version_unique
  on public.reservation_documents (reservation_traveler_id, version)
  where document_type = 'ticket'
    and reservation_traveler_id is not null;
