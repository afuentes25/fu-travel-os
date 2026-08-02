create table public.agency_customer_accounts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agency_customer_accounts_agency_user_unique unique (agency_id, user_id),
  constraint agency_customer_accounts_id_agency_unique unique (id, agency_id),
  constraint agency_customer_accounts_status_check
    check (status in ('active', 'invited', 'suspended'))
);

create index agency_customer_accounts_user_id_idx
  on public.agency_customer_accounts (user_id);
create index agency_customer_accounts_agency_id_idx
  on public.agency_customer_accounts (agency_id);
create index agency_customer_accounts_status_idx
  on public.agency_customer_accounts (status);
create index agency_customer_accounts_user_status_idx
  on public.agency_customer_accounts (user_id, status);

alter table public.reservation_snapshots
  add constraint reservation_snapshots_id_agency_unique unique (id, agency_id);

create table public.reservation_customer_access (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null,
  agency_id uuid not null,
  customer_account_id uuid not null,
  role text not null default 'primary',
  created_at timestamptz not null default now(),
  constraint reservation_customer_access_reservation_customer_unique
    unique (reservation_id, customer_account_id),
  constraint reservation_customer_access_role_check
    check (role in ('primary', 'traveler', 'payer', 'viewer')),
  constraint reservation_customer_access_reservation_agency_foreign_key
    foreign key (reservation_id, agency_id)
    references public.reservation_snapshots(id, agency_id)
    on delete cascade,
  constraint reservation_customer_access_customer_agency_foreign_key
    foreign key (customer_account_id, agency_id)
    references public.agency_customer_accounts(id, agency_id)
    on delete cascade
);

create index reservation_customer_access_customer_account_id_idx
  on public.reservation_customer_access (customer_account_id);
create index reservation_customer_access_reservation_id_idx
  on public.reservation_customer_access (reservation_id);
create index reservation_customer_access_agency_id_idx
  on public.reservation_customer_access (agency_id);
create index reservation_customer_access_customer_agency_idx
  on public.reservation_customer_access (customer_account_id, agency_id);
create index reservation_customer_access_reservation_agency_idx
  on public.reservation_customer_access (reservation_id, agency_id);

create trigger agency_customer_accounts_set_updated_at
before update on public.agency_customer_accounts
for each row execute function public.set_identity_updated_at();

create function public.has_customer_agency_access(target_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    auth.uid() is not null
    and target_agency_id is not null
    and exists (
      select 1
      from public.agency_customer_accounts as customer_account
      where customer_account.agency_id = target_agency_id
        and customer_account.user_id = auth.uid()
        and customer_account.status = 'active'
    ),
    false
  );
$$;

create function public.has_customer_reservation_access(target_reservation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    auth.uid() is not null
    and target_reservation_id is not null
    and exists (
      select 1
      from public.reservation_customer_access as access_link
      join public.agency_customer_accounts as customer_account
        on customer_account.id = access_link.customer_account_id
       and customer_account.agency_id = access_link.agency_id
      where access_link.reservation_id = target_reservation_id
        and customer_account.user_id = auth.uid()
        and customer_account.status = 'active'
    ),
    false
  );
$$;

alter table public.agency_customer_accounts enable row level security;
alter table public.reservation_customer_access enable row level security;

create policy agency_customer_accounts_select_own
on public.agency_customer_accounts
for select
to authenticated
using (user_id = (select auth.uid()));

create policy reservation_customer_access_select_own_active
on public.reservation_customer_access
for select
to authenticated
using ((select public.has_customer_reservation_access(reservation_id)));

revoke all on table public.agency_customer_accounts from public, anon, authenticated;
revoke all on table public.reservation_customer_access from public, anon, authenticated;
grant select on table public.agency_customer_accounts to authenticated;
grant select on table public.reservation_customer_access to authenticated;

revoke all on function public.has_customer_agency_access(uuid) from public, anon;
revoke all on function public.has_customer_reservation_access(uuid) from public, anon;
grant execute on function public.has_customer_agency_access(uuid) to authenticated;
grant execute on function public.has_customer_reservation_access(uuid) to authenticated;
