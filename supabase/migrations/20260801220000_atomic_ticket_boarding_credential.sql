-- The PDF is uploaded before this RPC. This transaction makes its document
-- metadata and the hash-only boarding credential appear together.
create function public.finalize_ticket_with_boarding_credential_atomic(
  target_agency_id uuid,
  target_reservation_id uuid,
  target_traveler_id uuid,
  target_document_id uuid,
  target_version integer,
  target_storage_path text,
  target_file_size_bytes bigint,
  target_content_sha256 text,
  target_token_sha256 text,
  target_generated_at timestamptz,
  target_issued_by_user_id uuid
) returns table (result_status text, ticket_version integer, ticket_generated_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  traveler_row public.reservation_travelers%rowtype;
  current_ticket public.reservation_documents%rowtype;
  max_version integer := 0;
  has_current boolean := false;
  issued_time timestamptz := now();
begin
  select * into traveler_row from public.reservation_travelers
  where id = target_traveler_id and reservation_id = target_reservation_id and agency_id = target_agency_id
  for update;
  if not found then return query select 'not_found'::text, null::integer, null::timestamptz; return; end if;
  if traveler_row.status <> 'complete' then return query select 'traveler_incomplete'::text, null::integer, null::timestamptz; return; end if;
  if target_document_id is null or target_version <= 0 or target_storage_path is null or btrim(target_storage_path) = ''
    or target_file_size_bytes <= 0 or target_content_sha256 is null or target_content_sha256 !~ '^[0-9a-f]{64}$'
    or target_token_sha256 is null or target_token_sha256 !~ '^[0-9a-f]{64}$' or target_generated_at is null or target_issued_by_user_id is null
  then return query select 'invalid_structure'::text, null::integer, null::timestamptz; return; end if;

  select * into current_ticket from public.reservation_documents
  where agency_id = target_agency_id and reservation_id = target_reservation_id
    and reservation_traveler_id = target_traveler_id and document_type = 'ticket' and status = 'available'
  for update;
  has_current := found;
  if found and exists (
    select 1 from public.traveler_boarding_credentials
    where ticket_document_id = current_ticket.id and reservation_traveler_id = target_traveler_id
      and reservation_id = target_reservation_id and agency_id = target_agency_id and status = 'active'
  ) then
    return query select 'existing'::text, current_ticket.version, current_ticket.generated_at; return;
  end if;

  select coalesce(max(version), 0) into max_version from public.reservation_documents
  where agency_id = target_agency_id and reservation_id = target_reservation_id
    and reservation_traveler_id = target_traveler_id and document_type = 'ticket';
  if target_version <> max_version + 1 then return query select 'conflict'::text, null::integer, null::timestamptz; return; end if;

  -- A current pre-boarding ticket is historical: it cannot gain a credential
  -- because its PDF does not carry the matching QR secret.
  if has_current then
    update public.traveler_boarding_credentials set status = 'revoked', revoked_at = issued_time
    where ticket_document_id = current_ticket.id and status = 'active';
    update public.reservation_documents set status = 'superseded' where id = current_ticket.id and status = 'available';
  end if;
  -- Repair an impossible stale active credential before the unique active key
  -- admits the newly issued credential; history is retained.
  update public.traveler_boarding_credentials set status = 'revoked', revoked_at = issued_time
  where agency_id = target_agency_id and reservation_id = target_reservation_id
    and reservation_traveler_id = target_traveler_id and status = 'active';

  insert into public.reservation_documents (
    id,reservation_id,agency_id,document_type,status,storage_path,mime_type,file_size_bytes,version,
    payment_id,contract_instance_id,contract_acceptance_id,reservation_traveler_id,content_sha256,generated_at,created_by_user_id
  ) values (
    target_document_id,target_reservation_id,target_agency_id,'ticket','available',target_storage_path,'application/pdf',target_file_size_bytes,target_version,
    null,null,null,target_traveler_id,target_content_sha256,target_generated_at,target_issued_by_user_id
  );
  insert into public.traveler_boarding_credentials (
    agency_id,reservation_id,reservation_traveler_id,ticket_document_id,token_sha256,status,issued_by_user_id,issued_at
  ) values (
    target_agency_id,target_reservation_id,target_traveler_id,target_document_id,target_token_sha256,'active',target_issued_by_user_id,issued_time
  );
  insert into public.traveler_boarding_state (reservation_traveler_id,reservation_id,agency_id,status)
  values (target_traveler_id,target_reservation_id,target_agency_id,'pending')
  on conflict (reservation_traveler_id) do nothing;
  return query select 'created'::text, target_version, target_generated_at;
end; $$;

-- Lifecycle transitions revoke the QR credential in the same transaction as
-- the Ticket document. They intentionally do not touch boarding state/events.
create function public.revoke_available_tickets_with_credentials_atomic(
  target_agency_id uuid,
  target_reservation_id uuid,
  target_traveler_id uuid default null
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Serializes a revocation with an individual ticket issuance while keeping
  -- independent travelers free to proceed concurrently.
  perform 1 from public.reservation_travelers
  where agency_id = target_agency_id and reservation_id = target_reservation_id
    and (target_traveler_id is null or id = target_traveler_id)
  for update;
  update public.traveler_boarding_credentials credential
  set status = 'revoked', revoked_at = now()
  from public.reservation_documents document
  where credential.ticket_document_id = document.id and credential.status = 'active'
    and document.agency_id = target_agency_id and document.reservation_id = target_reservation_id
    and document.document_type = 'ticket' and document.status = 'available'
    and (target_traveler_id is null or document.reservation_traveler_id = target_traveler_id);
  update public.reservation_documents set status = 'revoked'
  where agency_id = target_agency_id and reservation_id = target_reservation_id
    and document_type = 'ticket' and status = 'available'
    and (target_traveler_id is null or reservation_traveler_id = target_traveler_id);
end; $$;

revoke all on function public.finalize_ticket_with_boarding_credential_atomic(uuid,uuid,uuid,uuid,integer,text,bigint,text,text,timestamptz,uuid) from public, anon, authenticated;
grant execute on function public.finalize_ticket_with_boarding_credential_atomic(uuid,uuid,uuid,uuid,integer,text,bigint,text,text,timestamptz,uuid) to service_role;
revoke all on function public.revoke_available_tickets_with_credentials_atomic(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.revoke_available_tickets_with_credentials_atomic(uuid,uuid,uuid) to service_role;
