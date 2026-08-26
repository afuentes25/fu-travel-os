-- Agency-scoped customer profile data. Authentication and the verified login
-- email remain owned by Supabase Auth; these fields are only contact details
-- used to prefill future bookings for the same agency.
alter table public.agency_customer_accounts
  add column first_name text null,
  add column last_name text null,
  add column phone text null,
  add constraint agency_customer_accounts_first_name_length_check
    check (first_name is null or char_length(first_name) between 1 and 120),
  add constraint agency_customer_accounts_last_name_length_check
    check (last_name is null or char_length(last_name) between 1 and 120),
  add constraint agency_customer_accounts_phone_length_check
    check (phone is null or char_length(phone) between 1 and 60);

-- Existing RLS intentionally remains read-only for authenticated users. The
-- server-side profile service verifies ownership before writing with service
-- credentials, so this migration does not widen direct client permissions.
