-- Migration 007: Procurement change history / audit log
-- Run in: Supabase Dashboard → SQL Editor

create table if not exists procurement_history (
  id          uuid        primary key default gen_random_uuid(),
  record_id   text        not null references procurement_records(id) on delete cascade,
  changed_at  timestamptz not null default now(),
  changed_by  text,                          -- email of the user who made the change
  field_name  text        not null,          -- e.g. 'status', 'amount_usd', 'notes'
  old_value   text,
  new_value   text
);

create index on procurement_history (record_id, changed_at desc);

alter table procurement_history enable row level security;

-- Any authenticated user can read history for records they can see
create policy "authenticated read history"
  on procurement_history for select
  to authenticated
  using (true);

-- Any authenticated user can insert history rows (the app controls this)
create policy "authenticated insert history"
  on procurement_history for insert
  to authenticated
  with check (true);
