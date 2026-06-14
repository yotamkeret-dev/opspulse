-- Migration 002: Create import_templates table
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS / IF NOT EXISTS policies)

create table if not exists import_templates (
  id             text        not null,
  name           text        not null,
  description    text        not null default '',
  target_schema  text        not null,
  field_mappings jsonb       not null default '[]',
  created_by     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint import_templates_pkey primary key (id)
);

-- Row-level security
alter table import_templates enable row level security;

-- All authenticated team members can read all templates
create policy "team read templates"
  on import_templates
  for select
  to authenticated
  using (true);

-- Any authenticated user can create a template
create policy "team insert templates"
  on import_templates
  for insert
  to authenticated
  with check (true);

-- Users can only update templates they created
-- (created_by stores the creator's email address)
create policy "own update templates"
  on import_templates
  for update
  to authenticated
  using  (created_by = auth.email())
  with check (created_by = auth.email());

-- Users can only delete templates they created
create policy "own delete templates"
  on import_templates
  for delete
  to authenticated
  using (created_by = auth.email());
