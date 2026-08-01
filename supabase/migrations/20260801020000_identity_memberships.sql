create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agency_memberships (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agency_memberships_agency_user_unique unique (agency_id, user_id),
  constraint agency_memberships_role_check
    check (role in ('owner', 'admin', 'staff')),
  constraint agency_memberships_status_check
    check (status in ('active', 'invited', 'suspended'))
);

create index agency_memberships_user_id_idx
  on public.agency_memberships (user_id);
create index agency_memberships_agency_id_idx
  on public.agency_memberships (agency_id);
create index agency_memberships_role_idx
  on public.agency_memberships (role);
create index agency_memberships_status_idx
  on public.agency_memberships (status);

create function public.set_identity_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_identity_updated_at();

create trigger agency_memberships_set_updated_at
before update on public.agency_memberships
for each row execute function public.set_identity_updated_at();

create function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user_profile();

create function public.has_agency_role(
  target_agency_id uuid,
  allowed_roles text[]
)
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
      from public.agency_memberships as membership
      where membership.agency_id = target_agency_id
        and membership.user_id = auth.uid()
        and membership.status = 'active'
        and membership.role = any (allowed_roles)
    ),
    false
  );
$$;

alter table public.profiles enable row level security;
alter table public.agency_memberships enable row level security;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (user_id = (select auth.uid()));

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy agency_memberships_select_own
on public.agency_memberships
for select
to authenticated
using (user_id = (select auth.uid()));

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.agency_memberships from public, anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name, phone) on table public.profiles to authenticated;
grant select on table public.agency_memberships to authenticated;

revoke all on function public.set_identity_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user_profile() from public, anon, authenticated;
revoke all on function public.has_agency_role(uuid, text[]) from public, anon;
grant execute on function public.has_agency_role(uuid, text[]) to authenticated;
