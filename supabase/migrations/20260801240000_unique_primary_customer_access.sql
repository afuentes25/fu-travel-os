do $$
begin
  if exists (
    select 1
    from public.reservation_customer_access
    where role = 'primary'
    group by agency_id, reservation_id
    having count(*) > 1
  ) then
    raise exception using
      message = 'Cannot enforce one primary customer access per reservation because duplicate primary accesses already exist.',
      hint = 'Resolve duplicate primary reservation_customer_access rows manually before applying this migration.';
  end if;
end;
$$;

create unique index reservation_customer_access_one_primary_per_reservation_idx
  on public.reservation_customer_access (agency_id, reservation_id)
  where role = 'primary';
