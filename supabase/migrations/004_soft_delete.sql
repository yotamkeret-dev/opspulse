-- Migration 004: Soft delete on procurement_records + admin function
-- Run in: Supabase Dashboard → SQL Editor

-- 1. Add soft-delete columns
alter table procurement_records
  add column if not exists deleted_at       timestamptz,
  add column if not exists deleted_by       text,
  add column if not exists deletion_reason  text;

-- 2. Admin check function
--    Keep this list in sync with lib/approved-members.ts → ADMIN_EMAILS
--    Re-run this block whenever ADMIN_EMAILS changes in code.
create or replace function is_procurement_admin()
returns boolean
language sql
security definer
stable
as $$
  select auth.email() in (
    'yotam.keret@orca-ai.io'
    -- add additional admin emails here, one per line, comma-separated
  );
$$;

-- 3. Update SELECT policy: exclude soft-deleted rows from all team queries
drop policy if exists "team read procurement" on procurement_records;
create policy "team read procurement"
  on procurement_records
  for select
  to authenticated
  using (deleted_at is null);

-- 4. Update UPDATE policy: allow soft-delete by creator or admin
--    Covers both field edits (existing) and setting deleted_at (new).
drop policy if exists "own update procurement" on procurement_records;
drop policy if exists "own update or delete procurement" on procurement_records;

create policy "own update or soft-delete procurement"
  on procurement_records
  for update
  to authenticated
  using (
    deleted_at is null
    and (
      created_by  = auth.email()    -- record creator
      or employee_id = auth.email() -- selected employee (backward compat, legacy rows)
      or is_procurement_admin()     -- admin override
    )
  )
  with check (true);
