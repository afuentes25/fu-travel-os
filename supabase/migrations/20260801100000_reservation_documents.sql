-- Operational documents stay separate from the immutable reservation snapshot.
create table public.reservation_documents (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null,
  agency_id uuid not null,
  document_type text not null,
  status text not null default 'available',
  storage_path text not null,
  mime_type text not null default 'application/pdf',
  file_size_bytes bigint not null,
  version integer not null default 1,
  payment_id uuid,
  generated_at timestamptz not null default now(),
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservation_documents_reservation_agency_foreign_key
    foreign key (reservation_id, agency_id)
    references public.reservation_snapshots(id, agency_id)
    on delete cascade,
  constraint reservation_documents_payment_reservation_agency_foreign_key
    foreign key (payment_id, reservation_id, agency_id)
    references public.reservation_payments(id, reservation_id, agency_id)
    on delete restrict,
  constraint reservation_documents_type_check
    check (document_type in ('payment_receipt', 'contract', 'voucher', 'ticket')),
  constraint reservation_documents_status_check
    check (status in ('available', 'superseded', 'revoked')),
  constraint reservation_documents_payment_type_check
    check (payment_id is null or document_type = 'payment_receipt'),
  constraint reservation_documents_storage_path_check
    check (btrim(storage_path) <> ''),
  constraint reservation_documents_mime_type_check
    check (mime_type = 'application/pdf'),
  constraint reservation_documents_file_size_positive_check
    check (file_size_bytes > 0),
  constraint reservation_documents_version_positive_check
    check (version > 0)
);

-- General documents version per reservation/type. Receipts version per payment,
-- allowing a reservation to retain receipts for several distinct payments.
create unique index reservation_documents_general_version_unique
  on public.reservation_documents (reservation_id, document_type, version)
  where payment_id is null;

create unique index reservation_documents_payment_version_unique
  on public.reservation_documents (payment_id, document_type, version)
  where payment_id is not null;

create index reservation_documents_reservation_agency_idx
  on public.reservation_documents (reservation_id, agency_id);
create index reservation_documents_type_idx
  on public.reservation_documents (document_type);
create index reservation_documents_payment_idx
  on public.reservation_documents (payment_id)
  where payment_id is not null;

create trigger reservation_documents_set_updated_at
before update on public.reservation_documents
for each row execute function public.set_identity_updated_at();

alter table public.reservation_documents enable row level security;

create policy reservation_documents_select_customer_linked
on public.reservation_documents
for select
to authenticated
using ((select public.has_customer_reservation_access(reservation_id)));

create policy reservation_documents_select_agency_members
on public.reservation_documents
for select
to authenticated
using (
  (select public.has_agency_role(
    agency_id,
    array['owner', 'admin', 'staff']::text[]
  ))
);

revoke all on table public.reservation_documents from public, anon, authenticated;
grant select on table public.reservation_documents to authenticated;

-- Private by design. Future access is through authorized, short-lived URLs.
insert into storage.buckets (id, name, public)
values ('reservation-documents', 'reservation-documents', false)
on conflict (id) do update
set public = false;
