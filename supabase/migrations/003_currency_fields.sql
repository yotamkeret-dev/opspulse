-- Migration 003: Currency fields + created_by on procurement_records
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS / defaults)

alter table procurement_records
  add column if not exists original_amount    numeric,
  add column if not exists original_currency  text    not null default 'USD',
  add column if not exists exchange_rate      numeric,
  add column if not exists exchange_rate_date date,
  add column if not exists created_by         text;   -- was missing from initial schema

-- Backfill: all existing records are assumed to be USD (no prior multi-currency support)
update procurement_records
  set original_amount    = amount_usd,
      original_currency  = 'USD',
      exchange_rate      = 1,
      exchange_rate_date = activity_date
  where original_currency = 'USD'
    and original_amount is null
    and amount_usd is not null;
