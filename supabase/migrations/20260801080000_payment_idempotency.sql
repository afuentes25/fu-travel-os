alter table public.reservation_payments
  add column if not exists idempotency_key uuid;

create unique index if not exists reservation_payments_agency_idempotency_key_uidx
  on public.reservation_payments (agency_id, idempotency_key)
  where idempotency_key is not null;
