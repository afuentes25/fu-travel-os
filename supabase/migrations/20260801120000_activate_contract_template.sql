-- Activates one contractual draft atomically. Human authorization is enforced
-- by the server command before this privileged RPC is invoked.
create function public.activate_agency_contract_template(
  target_agency_id uuid,
  target_template_id uuid,
  expected_active_template_id uuid default null
)
returns table (result_status text, activated_version integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_active_id uuid;
  target_status text;
  target_version integer;
  legal_name_value text;
begin
  -- Serializes transitions only for this agency; other agencies remain free.
  perform 1
  from public.agencies
  where id = target_agency_id
  for update;

  if not found then
    return query select 'not_found'::text, null::integer;
    return;
  end if;

  select template.status, template.version
    into target_status, target_version
  from public.agency_contract_templates as template
  where template.id = target_template_id
    and template.agency_id = target_agency_id
  for update;

  if not found then
    return query select 'not_found'::text, null::integer;
    return;
  end if;

  if target_status <> 'draft' then
    return query select 'immutable_version'::text, null::integer;
    return;
  end if;

  select profile.legal_name
    into legal_name_value
  from public.agency_legal_profiles as profile
  where profile.agency_id = target_agency_id;

  if legal_name_value is null or btrim(legal_name_value) = '' then
    return query select 'legal_profile_required'::text, null::integer;
    return;
  end if;

  select template.id
    into current_active_id
  from public.agency_contract_templates as template
  where template.agency_id = target_agency_id
    and template.status = 'active';

  if current_active_id is distinct from expected_active_template_id then
    return query select 'conflict'::text, null::integer;
    return;
  end if;

  if current_active_id is not null then
    update public.agency_contract_templates
    set status = 'retired', updated_at = now()
    where id = current_active_id
      and agency_id = target_agency_id
      and status = 'active';
  end if;

  update public.agency_contract_templates
  set status = 'active', activated_at = now(), updated_at = now()
  where id = target_template_id
    and agency_id = target_agency_id
    and status = 'draft';

  if not found then
    raise exception 'contract template activation target changed concurrently';
  end if;

  return query select 'activated'::text, target_version;
end;
$$;

revoke all on function public.activate_agency_contract_template(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.activate_agency_contract_template(uuid, uuid, uuid)
  to service_role;
