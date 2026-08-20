-- Customer account resolution embeds agency data through the authenticated
-- SSR client. The base migration intentionally revoked general agency reads;
-- grant this narrow read only to active customer accounts of that agency.
grant select on table public.agencies to authenticated;

create policy agencies_select_active_customer_account
on public.agencies
for select
to authenticated
using (public.has_customer_agency_access(id));
