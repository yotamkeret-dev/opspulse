-- Migration 006: Align procurement_records status constraint with frontend values
-- Run in: Supabase Dashboard → SQL Editor
--
-- The original table was created with status values that differ from the
-- current frontend canonical values ('PO Issued', 'PO Arrived').
-- This migration normalises existing rows and replaces the constraint.

-- 1. Normalise existing rows to the new canonical values
--    Map any legacy status → 'PO Arrived' (delivered/paid/closed/received/approved)
--                          → 'PO Issued'  (everything else / default)
update procurement_records
set status = case
  when lower(status) in (
    'po arrived', 'arrived', 'delivered', 'paid', 'closed',
    'received', 'goods receipt', 'bill', 'completed', 'done'
  ) then 'PO Arrived'
  else 'PO Issued'
end
where status not in ('PO Issued', 'PO Arrived');

-- 2. Drop the old check constraint (name may vary; both forms listed for safety)
alter table procurement_records
  drop constraint if exists procurement_status_check;

alter table procurement_records
  drop constraint if exists procurement_records_status_check;

-- 3. Add new constraint with the current canonical values
alter table procurement_records
  add constraint procurement_status_check
  check (status in ('PO Issued', 'PO Arrived'));
