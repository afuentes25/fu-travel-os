-- A traveler can transition through each operational event only once. The
-- state row lock below is the primary serialisation mechanism; this index is
-- the final protection against a duplicate event from a retry.
create unique index traveler_boarding_events_one_transition_per_traveler_unique
  on public.traveler_boarding_events (reservation_traveler_id, event_type)
  where event_type in ('checked_in', 'boarded');

create function public.check_in_traveler_atomic(
  target_agency_id uuid,
  target_token_sha256 text,
  target_actor_user_id uuid
) returns table (result_status text, checked_in_at timestamptz, boarded_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  credential_row public.traveler_boarding_credentials%rowtype;
  ticket_row public.reservation_documents%rowtype;
  state_row public.traveler_boarding_state%rowtype;
  transition_time timestamptz := now();
begin
  if target_token_sha256 is null or target_token_sha256 !~ '^[0-9a-f]{64}$' or target_actor_user_id is null then
    return query select 'invalid_structure'::text, null::timestamptz, null::timestamptz; return;
  end if;

  select * into credential_row from public.traveler_boarding_credentials
  where agency_id = target_agency_id and token_sha256 = target_token_sha256
  for update;
  if not found or credential_row.status <> 'active' then
    return query select 'credential_unavailable'::text, null::timestamptz, null::timestamptz; return;
  end if;

  select * into ticket_row from public.reservation_documents
  where id = credential_row.ticket_document_id
    and agency_id = target_agency_id and reservation_id = credential_row.reservation_id
    and reservation_traveler_id = credential_row.reservation_traveler_id
  for update;
  if not found or ticket_row.document_type <> 'ticket' or ticket_row.status <> 'available' then
    return query select 'credential_unavailable'::text, null::timestamptz, null::timestamptz; return;
  end if;

  select * into state_row from public.traveler_boarding_state
  where reservation_traveler_id = credential_row.reservation_traveler_id
    and reservation_id = credential_row.reservation_id and agency_id = target_agency_id
  for update;
  if not found then
    return query select 'invalid_structure'::text, null::timestamptz, null::timestamptz; return;
  end if;
  if state_row.status = 'boarded' then
    return query select 'already_boarded'::text, state_row.checked_in_at, state_row.boarded_at; return;
  end if;
  if state_row.status = 'checked_in' then
    return query select 'already_checked_in'::text, state_row.checked_in_at, null::timestamptz; return;
  end if;
  if state_row.status <> 'pending' then
    return query select 'invalid_structure'::text, null::timestamptz, null::timestamptz; return;
  end if;

  update public.traveler_boarding_state
  set status = 'checked_in', checked_in_at = transition_time, checked_in_by_user_id = target_actor_user_id
  where reservation_traveler_id = credential_row.reservation_traveler_id;
  insert into public.traveler_boarding_events (
    agency_id,reservation_id,reservation_traveler_id,boarding_credential_id,event_type,performed_by_user_id,occurred_at
  ) values (
    target_agency_id,credential_row.reservation_id,credential_row.reservation_traveler_id,credential_row.id,'checked_in',target_actor_user_id,transition_time
  );
  return query select 'checked_in'::text, transition_time, null::timestamptz;
end; $$;

create function public.board_traveler_atomic(
  target_agency_id uuid,
  target_token_sha256 text,
  target_actor_user_id uuid
) returns table (result_status text, checked_in_at timestamptz, boarded_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  credential_row public.traveler_boarding_credentials%rowtype;
  ticket_row public.reservation_documents%rowtype;
  state_row public.traveler_boarding_state%rowtype;
  transition_time timestamptz := now();
begin
  if target_token_sha256 is null or target_token_sha256 !~ '^[0-9a-f]{64}$' or target_actor_user_id is null then
    return query select 'invalid_structure'::text, null::timestamptz, null::timestamptz; return;
  end if;

  select * into credential_row from public.traveler_boarding_credentials
  where agency_id = target_agency_id and token_sha256 = target_token_sha256
  for update;
  if not found or credential_row.status <> 'active' then
    return query select 'credential_unavailable'::text, null::timestamptz, null::timestamptz; return;
  end if;

  select * into ticket_row from public.reservation_documents
  where id = credential_row.ticket_document_id
    and agency_id = target_agency_id and reservation_id = credential_row.reservation_id
    and reservation_traveler_id = credential_row.reservation_traveler_id
  for update;
  if not found or ticket_row.document_type <> 'ticket' or ticket_row.status <> 'available' then
    return query select 'credential_unavailable'::text, null::timestamptz, null::timestamptz; return;
  end if;

  select * into state_row from public.traveler_boarding_state
  where reservation_traveler_id = credential_row.reservation_traveler_id
    and reservation_id = credential_row.reservation_id and agency_id = target_agency_id
  for update;
  if not found then
    return query select 'invalid_structure'::text, null::timestamptz, null::timestamptz; return;
  end if;
  if state_row.status = 'boarded' then
    return query select 'already_boarded'::text, state_row.checked_in_at, state_row.boarded_at; return;
  end if;
  if state_row.status = 'pending' then
    return query select 'check_in_required'::text, null::timestamptz, null::timestamptz; return;
  end if;
  if state_row.status <> 'checked_in' then
    return query select 'invalid_structure'::text, null::timestamptz, null::timestamptz; return;
  end if;

  update public.traveler_boarding_state
  set status = 'boarded', boarded_at = transition_time, boarded_by_user_id = target_actor_user_id
  where reservation_traveler_id = credential_row.reservation_traveler_id;
  insert into public.traveler_boarding_events (
    agency_id,reservation_id,reservation_traveler_id,boarding_credential_id,event_type,performed_by_user_id,occurred_at
  ) values (
    target_agency_id,credential_row.reservation_id,credential_row.reservation_traveler_id,credential_row.id,'boarded',target_actor_user_id,transition_time
  );
  return query select 'boarded'::text, state_row.checked_in_at, transition_time;
end; $$;

revoke all on function public.check_in_traveler_atomic(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.check_in_traveler_atomic(uuid,text,uuid) to service_role;
revoke all on function public.board_traveler_atomic(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.board_traveler_atomic(uuid,text,uuid) to service_role;
