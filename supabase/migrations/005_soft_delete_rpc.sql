-- Migration 005: RPC function for procurement soft-delete
-- Run in: Supabase Dashboard → SQL Editor
--
-- Motivation: direct frontend UPDATE fails with "new row violates row-level
-- security policy" because PostgREST appends RETURNING * to the SQL, and the
-- SELECT policy (deleted_at IS NULL) is then evaluated against the new row
-- after the soft delete sets deleted_at — causing the error even though the
-- UPDATE permission itself is granted.
--
-- This SECURITY DEFINER function runs as its owner (postgres), bypassing RLS
-- on the UPDATE. Permission is enforced inside the function body, so the
-- access rules are still fully respected.

create or replace function soft_delete_procurement_record(
  record_id text,
  reason    text default null
)
returns text
language plpgsql
security definer
as $$
declare
  caller_email  text := auth.email();
  rows_affected int;
begin
  update procurement_records
  set
    deleted_at      = now(),
    deleted_by      = caller_email,
    deletion_reason = reason
  where
    id         = record_id
    and deleted_at is null   -- idempotent: already-deleted rows are skipped
    and (
      created_by  = caller_email
      or employee_id = caller_email
      or is_procurement_admin()
    );

  get diagnostics rows_affected = row_count;

  if rows_affected = 0 then
    raise exception
      'Delete denied: record not found, already deleted, or insufficient permission'
      using errcode = 'insufficient_privilege';
  end if;

  return record_id;
end;
$$;

-- Allow any authenticated user to call this function.
-- The function body enforces the creator / employee / admin check internally.
grant execute on function soft_delete_procurement_record(text, text) to authenticated;
