create table public.reservation_payments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null,
  agency_id uuid not null,
  amount numeric(12, 2) not null,
  currency text not null,
  status text not null default 'pending',
  method text not null,
  source text not null default 'manual',
  reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservation_payments_reservation_agency_foreign_key
    foreign key (reservation_id, agency_id)
    references public.reservation_snapshots(id, agency_id)
    on delete cascade,
  constraint reservation_payments_amount_check
    check (amount > 0),
  constraint reservation_payments_currency_length_check
    check (char_length(currency) = 3),
  constraint reservation_payments_status_check
    check (status in ('pending', 'confirmed', 'cancelled')),
  constraint reservation_payments_method_check
    check (method in ('transfer', 'cash', 'card', 'payment_link', 'other')),
  constraint reservation_payments_source_check
    check (source in ('manual', 'gateway'))
);

create index reservation_payments_reservation_agency_idx
  on public.reservation_payments (reservation_id, agency_id);
create index reservation_payments_status_idx
  on public.reservation_payments (status);
create index reservation_payments_paid_at_idx
  on public.reservation_payments (paid_at);

create trigger reservation_payments_set_updated_at
before update on public.reservation_payments
for each row execute function public.set_identity_updated_at();

alter table public.reservation_payments enable row level security;

create policy reservation_payments_select_customer_linked
on public.reservation_payments
for select
to authenticated
using ((select public.has_customer_reservation_access(reservation_id)));

create policy reservation_payments_select_agency_members
on public.reservation_payments
for select
to authenticated
using (
  (select public.has_agency_role(
    agency_id,
    array['owner', 'admin', 'staff']::text[]
  ))
);

revoke all on table public.reservation_payments from public, anon, authenticated;
grant select on table public.reservation_payments to authenticated;
