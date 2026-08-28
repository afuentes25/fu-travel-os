-- Repairs only traveler slots that are absent or provably empty in historical
-- reservations. The immutable snapshot is read from the locked reservation;
-- draft.id is intentionally never used as identity.
create function public.reconcile_reservation_travelers_atomic(
  target_agency_id uuid,
  target_reservation_id uuid
)
returns table (
  result_status text,
  created_slots integer,
  filled_slots integer,
  preserved_slots integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  snapshot_row public.reservation_snapshots%rowtype;
  traveler_row public.reservation_travelers%rowtype;
  draft jsonb;
  adults integer;
  minors integer;
  total_travelers integer;
  draft_sequence integer;
  traveler_position integer;
  expected_traveler_type text;
  normalized_name text;
  name_parts text[];
  first_name_value text;
  last_name_value text;
  birth_date_text text;
  birth_date_value date;
  traveler_status text;
  created_count integer := 0;
  filled_count integer := 0;
  preserved_count integer := 0;
begin
  select reservation.*
    into snapshot_row
  from public.reservation_snapshots as reservation
  where reservation.id = target_reservation_id
    and reservation.agency_id = target_agency_id
  for update;

  if not found then
    return query select 'not_found'::text, 0, 0, 0;
    return;
  end if;

  -- Match the normal materializer's strict booked-occupancy requirements.
  if coalesce(snapshot_row.snapshot #>> '{occupancy,adults}', '') !~ '^[1-9][0-9]*$'
    or coalesce(snapshot_row.snapshot #>> '{occupancy,minors}', '') !~ '^[0-9]+$'
    or coalesce(snapshot_row.snapshot #>> '{occupancy,totalTravelers}', '') !~ '^[1-9][0-9]*$'
    or coalesce(snapshot_row.snapshot #>> '{travelers,adults}', '') !~ '^[1-9][0-9]*$'
    or coalesce(snapshot_row.snapshot #>> '{travelers,minors}', '') !~ '^[0-9]+$' then
    return query select 'invalid_structure'::text, 0, 0, 0;
    return;
  end if;

  adults := (snapshot_row.snapshot #>> '{occupancy,adults}')::integer;
  minors := (snapshot_row.snapshot #>> '{occupancy,minors}')::integer;
  total_travelers := (snapshot_row.snapshot #>> '{occupancy,totalTravelers}')::integer;
  if total_travelers <> adults + minors
    or (snapshot_row.snapshot #>> '{travelers,adults}')::integer <> adults
    or (snapshot_row.snapshot #>> '{travelers,minors}')::integer <> minors then
    return query select 'invalid_structure'::text, 0, 0, 0;
    return;
  end if;

  if jsonb_typeof(snapshot_row.snapshot #> '{travelers,drafts}') <> 'array'
    or jsonb_array_length(snapshot_row.snapshot #> '{travelers,drafts}') = 0 then
    return query select 'no_drafts'::text, 0, 0, 0;
    return;
  end if;

  -- Validate all draft positions before changing any canonical row.
  if exists (
    select 1
    from jsonb_array_elements(snapshot_row.snapshot #> '{travelers,drafts}') as draft_rows(draft)
    where coalesce(draft_rows.draft ->> 'category', '') not in ('adult', 'minor')
      or coalesce(draft_rows.draft ->> 'sequence', '') !~ '^[1-9][0-9]*$'
      or (
        draft_rows.draft ->> 'category' = 'adult'
        and (draft_rows.draft ->> 'sequence')::integer > adults
      )
      or (
        draft_rows.draft ->> 'category' = 'minor'
        and (draft_rows.draft ->> 'sequence')::integer > minors
      )
  ) or exists (
    select 1
    from jsonb_array_elements(snapshot_row.snapshot #> '{travelers,drafts}') as draft_rows(draft)
    group by draft_rows.draft ->> 'category', draft_rows.draft ->> 'sequence'
    having count(*) > 1
  ) then
    return query select 'invalid_structure'::text, 0, 0, 0;
    return;
  end if;

  -- This is the SQL equivalent of projectReservationTravelerMaterialization:
  -- category + sequence select a slot; fullName splits at the final whitespace;
  -- birthDate is accepted only as a strict calendar date; draft.id is ignored.
  for draft in
    select draft_rows.draft
    from jsonb_array_elements(snapshot_row.snapshot #> '{travelers,drafts}') as draft_rows(draft)
    order by
      case when draft_rows.draft ->> 'category' = 'adult' then 0 else 1 end,
      (draft_rows.draft ->> 'sequence')::integer
  loop
    expected_traveler_type := draft ->> 'category';
    draft_sequence := (draft ->> 'sequence')::integer;
    traveler_position := case
      when expected_traveler_type = 'adult' then draft_sequence
      else adults + draft_sequence
    end;

    normalized_name := nullif(
      regexp_replace(btrim(coalesce(draft ->> 'fullName', '')), '\s+', ' ', 'g'),
      ''
    );
    if normalized_name is null then
      first_name_value := null;
      last_name_value := null;
    else
      name_parts := regexp_split_to_array(normalized_name, '\s+');
      if array_length(name_parts, 1) = 1 then
        first_name_value := name_parts[1];
        last_name_value := null;
      else
        first_name_value := array_to_string(
          name_parts[1:array_length(name_parts, 1) - 1],
          ' '
        );
        last_name_value := name_parts[array_length(name_parts, 1)];
      end if;
    end if;

    birth_date_text := nullif(btrim(draft ->> 'birthDate'), '');
    if birth_date_text is not null
      and birth_date_text ~ '^\d{4}-\d{2}-\d{2}$'
      and to_char(to_date(birth_date_text, 'YYYY-MM-DD'), 'YYYY-MM-DD') = birth_date_text then
      birth_date_value := to_date(birth_date_text, 'YYYY-MM-DD');
    else
      birth_date_value := null;
    end if;

    traveler_status := case
      when snapshot_row.snapshot #>> '{travelers,status}' = 'complete'
        and draft ->> 'completionStatus' = 'complete'
        and first_name_value is not null
      then 'complete'
      else 'pending'
    end;

    select traveler.*
      into traveler_row
    from public.reservation_travelers as traveler
    where traveler.agency_id = target_agency_id
      and traveler.reservation_id = target_reservation_id
      and traveler.position = traveler_position
    for update;

    if not found then
      insert into public.reservation_travelers (
        agency_id,
        reservation_id,
        position,
        traveler_type,
        first_name,
        last_name,
        birth_date,
        status
      ) values (
        target_agency_id,
        target_reservation_id,
        traveler_position,
        expected_traveler_type,
        first_name_value,
        last_name_value,
        birth_date_value,
        traveler_status
      );
      created_count := created_count + 1;
    elsif traveler_row.first_name is not null
      or traveler_row.last_name is not null
      or traveler_row.birth_date is not null
      or traveler_row.status <> 'pending'
      or traveler_row.traveler_type <> expected_traveler_type then
      preserved_count := preserved_count + 1;
    else
      -- The only overwrite allowed by this maintenance command: a pending row
      -- with all three canonical traveler fields NULL.
      update public.reservation_travelers
      set first_name = first_name_value,
          last_name = last_name_value,
          birth_date = birth_date_value,
          status = traveler_status
      where id = traveler_row.id
        and agency_id = target_agency_id
        and reservation_id = target_reservation_id
        and position = traveler_position
        and traveler_type = expected_traveler_type
        and status = 'pending'
        and first_name is null
        and last_name is null
        and birth_date is null;
      if found then
        filled_count := filled_count + 1;
      else
        preserved_count := preserved_count + 1;
      end if;
    end if;
  end loop;

  return query select case
    when created_count > 0 or filled_count > 0 then 'reconciled'::text
    else 'no_action'::text
  end, created_count, filled_count, preserved_count;
end;
$$;

revoke all on function public.reconcile_reservation_travelers_atomic(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.reconcile_reservation_travelers_atomic(uuid, uuid)
  to service_role;
