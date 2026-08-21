-- Customer-reported payments remain operational ledger rows; contractual snapshots stay immutable.
alter table public.reservation_payments
  drop constraint if exists reservation_payments_source_check;

alter table public.reservation_payments
  add constraint reservation_payments_source_check
    check (source in ('manual', 'gateway', 'customer'));

alter table public.reservation_payments
  add column if not exists submitted_by_customer_account_id uuid;

alter table public.reservation_payments
  add constraint reservation_payments_submitted_customer_agency_foreign_key
    foreign key (submitted_by_customer_account_id, agency_id)
    references public.agency_customer_accounts(id, agency_id)
    on delete set null (submitted_by_customer_account_id);

-- Required by the evidence FK: validates payment, reservation and tenant in one relationship.
alter table public.reservation_payments
  add constraint reservation_payments_id_reservation_agency_unique
    unique (id, reservation_id, agency_id);

create table public.payment_evidence (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null,
  reservation_id uuid not null,
  agency_id uuid not null,
  storage_path text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  uploaded_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint payment_evidence_payment_unique unique (payment_id),
  constraint payment_evidence_reservation_agency_foreign_key
    foreign key (reservation_id, agency_id)
    references public.reservation_snapshots(id, agency_id)
    on delete cascade,
  constraint payment_evidence_payment_reservation_agency_foreign_key
    foreign key (payment_id, reservation_id, agency_id)
    references public.reservation_payments(id, reservation_id, agency_id)
    on delete cascade,
  constraint payment_evidence_storage_path_check
    check (btrim(storage_path) <> ''),
  constraint payment_evidence_mime_type_check
    check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  constraint payment_evidence_file_size_positive_check
    check (file_size_bytes > 0)
);

-- payment_evidence_payment_unique is also the payment_id lookup index.
create index payment_evidence_reservation_agency_idx
  on public.payment_evidence (reservation_id, agency_id);

-- The bucket remains private. Future reads/uploads stay behind authorized server operations.
insert into storage.buckets (id, name, public)
values ('payment-evidence', 'payment-evidence', false)
on conflict (id) do update
set public = false;

alter table public.payment_evidence enable row level security;

create policy payment_evidence_select_customer_linked
on public.payment_evidence
for select
to authenticated
using ((select public.has_customer_reservation_access(reservation_id)));

create policy payment_evidence_select_agency_members
on public.payment_evidence
for select
to authenticated
using (
  (select public.has_agency_role(
    agency_id,
    array['owner', 'admin', 'staff']::text[]
  ))
);

revoke all on table public.payment_evidence from public, anon, authenticated;
grant select on table public.payment_evidence to authenticated;
