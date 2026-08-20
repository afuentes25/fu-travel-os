alter table public.reservation_payments
  add column if not exists created_by_user_id uuid,
  add column if not exists status_changed_by_user_id uuid,
  add column if not exists status_changed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reservation_payments_created_by_user_id_fkey'
      and conrelid = 'public.reservation_payments'::regclass
  ) then
    alter table public.reservation_payments
      add constraint reservation_payments_created_by_user_id_fkey
      foreign key (created_by_user_id)
      references auth.users(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'reservation_payments_status_changed_by_user_id_fkey'
      and conrelid = 'public.reservation_payments'::regclass
  ) then
    alter table public.reservation_payments
      add constraint reservation_payments_status_changed_by_user_id_fkey
      foreign key (status_changed_by_user_id)
      references auth.users(id)
      on delete set null;
  end if;
end
$$;

create index if not exists reservation_payments_created_by_user_id_idx
  on public.reservation_payments (created_by_user_id);
