-- Reservation snapshots remain immutable during normal application use. The
-- narrowly-scoped DELETE exception below is usable only inside the private
-- maintenance RPC and only for that transaction.
create or replace function public.prevent_reservation_snapshot_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE'
    and current_setting('app.reservation_maintenance_delete', true) = 'enabled' then
    return old;
  end if;

  raise exception 'Reservation snapshots are immutable';
end;
$$;

create function public.purge_demo_reservation_atomic(
  target_agency_id uuid,
  target_reservation_id uuid
)
returns table(result_status text, reservation_code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  snapshot_row public.reservation_snapshots%rowtype;
begin
  select * into snapshot_row
  from public.reservation_snapshots
  where id = target_reservation_id
    and agency_id = target_agency_id
  for update;

  if not found then
    return query select 'already_absent'::text, null::text;
    return;
  end if;

  -- Events depend on credentials; credentials and state depend on travelers.
  delete from public.traveler_boarding_events
  where reservation_id = target_reservation_id and agency_id = target_agency_id;

  delete from public.traveler_boarding_credentials
  where reservation_id = target_reservation_id and agency_id = target_agency_id;

  delete from public.traveler_boarding_state
  where reservation_id = target_reservation_id and agency_id = target_agency_id;

  -- Acceptance certificates reference acceptances. Contract documents remain
  -- until acceptances are gone because the acceptance provenance FK is RESTRICT.
  delete from public.reservation_documents
  where reservation_id = target_reservation_id
    and agency_id = target_agency_id
    and document_type = 'acceptance_certificate';

  delete from public.reservation_contract_acceptances
  where reservation_id = target_reservation_id and agency_id = target_agency_id;

  -- This removes tickets, contract PDFs, receipts and travel documents before
  -- their payment, contract-instance and traveler provenance rows.
  delete from public.reservation_documents
  where reservation_id = target_reservation_id and agency_id = target_agency_id;

  delete from public.reservation_contract_instances
  where reservation_id = target_reservation_id and agency_id = target_agency_id;

  delete from public.payment_evidence
  where reservation_id = target_reservation_id and agency_id = target_agency_id;

  delete from public.reservation_payments
  where reservation_id = target_reservation_id and agency_id = target_agency_id;

  delete from public.reservation_travelers
  where reservation_id = target_reservation_id and agency_id = target_agency_id;

  delete from public.reservation_customer_access
  where reservation_id = target_reservation_id and agency_id = target_agency_id;

  -- LOCAL makes this flag disappear automatically when this RPC transaction
  -- completes. UPDATE is never exempted by the trigger function.
  perform set_config('app.reservation_maintenance_delete', 'enabled', true);

  delete from public.reservation_snapshots
  where id = target_reservation_id and agency_id = target_agency_id;

  return query select 'deleted'::text, snapshot_row.reservation_code;
end;
$$;

revoke all on function public.purge_demo_reservation_atomic(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.purge_demo_reservation_atomic(uuid, uuid)
  to service_role;
