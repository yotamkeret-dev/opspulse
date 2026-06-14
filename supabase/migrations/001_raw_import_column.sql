-- Migration 001: Add raw_import column to procurement_records
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS)
-- Does NOT change any existing data or constraints.

alter table procurement_records
  add column if not exists raw_import jsonb;

-- raw_import stores:
--   sourceFile    text    -- original file name
--   sourceType    text    -- 'pdf' | 'excel' | 'csv'
--   importedAt    text    -- ISO timestamp of import
--   importVersion text    -- '1.0'
--   templateId    text    -- ID of the mapping template used (optional)
--   templateName  text    -- name of the mapping template used (optional)
