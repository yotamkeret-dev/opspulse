'use client';
import { useEffect, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { isAdmin } from '@/lib/approved-members';
import { convertToUsd, currencySymbol, SUPPORTED_CURRENCIES } from '@/lib/exchange-rate';
import {
  parseFile, getHeaders, detectColumnMappings, columnMatchesToMap,
  mapOraclePORow, ORACLE_PO_RULES, NETSUITE_PO_EXACT_MAP, isNetSuiteExport,
  fetchTemplates, saveTemplate, deleteTemplate, ORACLE_PO_DEFAULT_TEMPLATE,
  type RawRow, type MappedRecord, type ColumnMatch, type MappingTemplate,
} from '@/lib/import-engine';
import {
  ACTIVITY_CATEGORIES, DashboardKpi, KPIRecord, MONTH_NAMES, Period, PeriodType,
  OperationsCategory, OperationsRecord, OPERATIONS_CATEGORIES, OPERATIONS_STATUSES, mockOperationsRecords,
  OperationsStatus,
  ProcurementCategory, ProcurementRecord, ProcurementStatus, PROCUREMENT_CATEGORIES, PROCUREMENT_STATUSES,
  SupportLog, TeamMember, TimeFilter, UnifiedActivity, buildUnifiedActivities,
  currentTimeFilter, dashboardSections, filterLogsByTimeFilter, filterLogsByPeriod, getPreviousPeriod,
  getDateRangeForFilter, getTimeFilterLabel, kpiRecords, mockProcurementRecords, seedSupportLogs,
  teamMembers,
} from './data/mock';

// Round hours to nearest 0.5 and format for display (e.g. 4, 4.5, 72.5).
function fmtHours(n: number): string {
  const r = Math.round(n * 2) / 2;
  return String(r);
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${parseFloat((n / 1_000_000).toFixed(1))}M`;
  if (n >= 1_000)     return `$${parseFloat((n / 1_000).toFixed(1))}K`;
  return `$${Math.round(n)}`;
}

// ── Export helpers ────────────────────────────────────────────────────────────
async function exportRecordsToCSV(records: ProcurementRecord[], filename: string) {
  const headers = ['PO Number','Supplier','Amount USD','Original Amount','Currency','Status','Date','Category','Owner','Notes'];
  const rows = records.map(r => [
    r.poNumber, r.supplier, r.amountUsd,
    r.originalAmount ?? r.amountUsd, r.originalCurrency ?? 'USD',
    r.status, r.date, r.category, r.employeeName,
    (r.notes ?? '').replace(/\n/g, ' ').replace(/"/g, '""'),
  ]);
  const csv = [headers, ...rows].map(row => row.map(c => `"${c ?? ''}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function exportRecordsToExcel(records: ProcurementRecord[], filename: string) {
  const XLSX = await import('xlsx');
  const data  = records.map(r => ({
    'PO Number':       r.poNumber,
    'Supplier':        r.supplier,
    'Amount USD':      r.amountUsd,
    'Original Amount': r.originalAmount ?? r.amountUsd,
    'Currency':        r.originalCurrency ?? 'USD',
    'Status':          r.status,
    'Date':            r.date,
    'Category':        r.category,
    'Owner':           r.employeeName,
    'Notes':           r.notes,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Procurement');
  XLSX.writeFile(wb, filename);
}

// Maps the new TimeFilter to the legacy Period for sub-pages that still use mock data.
function timeFilterToPeriod(tf: TimeFilter): Period {
  return tf.periodType === 'week' ? 'weekly' : tf.periodType === 'month' ? 'monthly' : 'quarterly';
}

// ─── Mode flag ─────────────────────────────────────────────────────────────
// DEMO_MODE=true  → seed data + localStorage, no auth required (default when env var absent)
// DEMO_MODE=false → Supabase DB + email authentication enforced by middleware
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

// ─── localStorage persistence (Demo Mode only) ─────────────────────────────
const USER_LOGS_KEY = 'opspulse-user-logs';

function loadUserLogs(): SupportLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(USER_LOGS_KEY);
    return raw ? (JSON.parse(raw) as SupportLog[]) : [];
  } catch { return []; }
}

function persistUserLogs(logs: SupportLog[]): void {
  try { localStorage.setItem(USER_LOGS_KEY, JSON.stringify(logs)); } catch { /* silent */ }
}

// ─── Supabase helpers (Production Mode only) ───────────────────────────────
// Maps DB snake_case rows to our SupportLog camelCase type.
function rowToLog(row: Record<string, unknown>): SupportLog {
  return {
    id:           String(row.id),
    employeeId:   String(row.employee_id),
    employeeName: String(row.employee_name),
    department:   String(row.department),
    category:     String(row.category),
    title:        String(row.title),
    hours:        Number(row.hours),
    date:         String(row.date),
    week:         String(row.week),
    notes:        String(row.notes ?? ''),
    deletedAt:    row.deleted_at ? String(row.deleted_at) : undefined,
  };
}

// Fetches active team members from Supabase team_members table.
// Uses email as the stable TeamMember.id so the dropdown value is always email-based.
async function fetchTeamMembersFromDB(): Promise<TeamMember[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('team_members')
    .select('name, email, role')
    .eq('active', true)
    .order('name');
  if (error) { console.error('fetchTeamMembers:', error.message); return []; }
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id:    String(row.email),           // email as stable unique id
    name:  String(row.name),
    email: String(row.email),
    role:  String(row.role ?? 'Operations Specialist'),
  }));
}

async function fetchLogsFromDB(): Promise<SupportLog[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('support_logs')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    // Re-throw so the caller (bootstrap) knows the fetch failed.
    // A silent return [] here caused existing submissions to vanish on refresh
    // because setDbLogs([]) wiped local state with no user-visible error.
    console.error('fetchLogs error:', error.code, error.message, error.details);
    throw new Error(`Failed to load activities: ${error.message}`);
  }
  return (data ?? []).map(rowToLog);
}

async function insertLogToDB(
  log: SupportLog,
  userId: string,
  userEmail: string
): Promise<void> {
  const supabase = createClient();
  // Chain .select('id') so we can verify the row was actually committed.
  // Supabase returns { data: null, error: null } when an RLS INSERT policy
  // silently blocks the write — without .select() that looks like success.
  console.log('INSERTING LOG:', log);
  const { data, error } = await supabase
    .from('support_logs')
    .insert({
      id:             log.id,
      employee_id:    log.employeeId,
      employee_name:  log.employeeName,
      employee_email: userEmail,
      department:     log.department,
      category:       log.category,
      title:          log.title,
      hours:          log.hours,
      date:           log.date,
      week:           log.week,
      notes:          log.notes,
      created_by:     userId,
    })
    .select('id');

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error(
      'Activity was not saved — the record was silently rejected. ' +
      'Check that the support_logs RLS policies are correctly applied in Supabase.'
    );
  }
}

// ─── Procurement DB helpers ────────────────────────────────────────────────

function rowToProcurementRecord(row: Record<string, unknown>): ProcurementRecord {
  return {
    id:               String(row.id),
    employeeId:       String(row.employee_id),
    employeeName:     String(row.employee_name),
    poNumber:         String(row.po_number ?? ''),
    supplier:         String(row.supplier),
    amountUsd:        Number(row.amount_usd ?? 0),
    category:         String(row.category) as ProcurementRecord['category'],
    status:           String(row.status)   as ProcurementRecord['status'],
    notes:            String(row.notes ?? ''),
    date:             String(row.activity_date),
    // Multi-currency
    originalAmount:   row.original_amount   != null ? Number(row.original_amount)   : undefined,
    originalCurrency: row.original_currency ? String(row.original_currency) : 'USD',
    exchangeRate:     row.exchange_rate      != null ? Number(row.exchange_rate)      : undefined,
    exchangeRateDate: row.exchange_rate_date ? String(row.exchange_rate_date)         : undefined,
    // Ownership + soft delete
    createdBy:        row.created_by  ? String(row.created_by)  : undefined,
    deletedAt:        row.deleted_at  ? String(row.deleted_at)  : undefined,
    deletedBy:        row.deleted_by  ? String(row.deleted_by)  : undefined,
    deletionReason:   row.deletion_reason ? String(row.deletion_reason) : undefined,
  };
}

async function fetchProcurementFromDB(tf: TimeFilter): Promise<ProcurementRecord[]> {
  const supabase = createClient();
  const { start, end } = getDateRangeForFilter(tf);
  const { data, error } = await supabase
    .from('procurement_records')
    .select('*')
    .gte('activity_date', start.toISOString().slice(0, 10))
    .lte('activity_date', end.toISOString().slice(0, 10))
    .order('activity_date', { ascending: false });
  if (error) {
  console.error('fetchProcurement:', error.message);
  return [];
}

console.log('PROCUREMENT FROM DB:', data);

return (data ?? []).map(rowToProcurementRecord);
}
function normalizeProcurementStatus(status?: string): ProcurementRecord['status'] {
  const s = String(status ?? '').trim().toLowerCase();
  // Already canonical
  if (s === 'po arrived') return 'PO Arrived';
  if (s === 'po issued')  return 'PO Issued';
  // Delivered / received / paid / closed → goods have arrived
  if (
    s.includes('arrived')   || s.includes('delivered') || s.includes('receipt') ||
    s.includes('received')  || s.includes('paid')      || s.includes('closed')  ||
    s.includes('bill')      || s.includes('done')      || s.includes('complet') ||
    s.includes('approved')
  ) return 'PO Arrived';
  // Everything else (pending, ordered, issued, open, in-progress…) → PO Issued
  return 'PO Issued';
}
async function insertProcurementToDB(record: ProcurementRecord, createdByEmail?: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('procurement_records').insert({
    id:                  record.id,
    employee_id:         record.employeeId,
    employee_name:       record.employeeName,
    po_number:           record.poNumber || null,
    supplier:            record.supplier,
    amount_usd:          record.amountUsd || null,
    category:            record.category,
    status: normalizeProcurementStatus(record.status),
    notes:               record.notes,
    activity_date:
  record.date && /^\d{4}-\d{2}-\d{2}$/.test(record.date)
    ? record.date
    : new Date(record.date).toISOString().slice(0, 10),
    // Multi-currency fields
    original_amount:     record.originalAmount   ?? record.amountUsd ?? null,
    original_currency:   record.originalCurrency ?? 'USD',
    exchange_rate:       record.exchangeRate      ?? (record.originalCurrency === 'USD' || !record.originalCurrency ? 1 : null),
exchange_rate_date:
  record.exchangeRateDate && /^\d{4}-\d{2}-\d{2}$/.test(record.exchangeRateDate)
    ? record.exchangeRateDate
    : new Date().toISOString().slice(0, 10),    // Ownership
    created_by:          createdByEmail ?? null,
  });
  if (error) throw new Error(error.message);
}

// ─── Operations DB helpers ─────────────────────────────────────────────────

function rowToOperationsRecord(row: Record<string, unknown>): OperationsRecord {
  return {
    id:           String(row.id),
    employeeId:   String(row.employee_id),
    employeeName: String(row.employee_name),
    date:         String(row.activity_date),
    category:     String(row.category) as OperationsRecord['category'],
    quantity:     Number(row.quantity),
    notes:        String(row.notes ?? ''),
    status:       String(row.status)   as OperationsRecord['status'],
  };
}

async function fetchOperationsFromDB(tf: TimeFilter): Promise<OperationsRecord[]> {
  const supabase = createClient();
  const { start, end } = getDateRangeForFilter(tf);
  const { data, error } = await supabase
    .from('operations_records')
    .select('*')
.is('deleted_at', null)
.gte('activity_date', start.toISOString().slice(0, 10))
    .lte('activity_date', end.toISOString().slice(0, 10))
    .order('activity_date', { ascending: false });
  if (error) { console.error('fetchOperations:', error.message); return []; }
  return (data ?? []).map(rowToOperationsRecord);
}

async function insertOperationsToDB(record: OperationsRecord): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('operations_records').insert({
    id:            record.id,
    employee_id:   record.employeeId,
    employee_name: record.employeeName,
   activity_date: record.date,
    category:      record.category,
    quantity:      record.quantity,
    notes:         record.notes,
    status:        record.status,
  });
  if (error) throw new Error(error.message);
}

// ─── Update DB helpers (edit own records) ──────────────────────────────────

async function updateSupportLogInDB(id: string, patch: Partial<SupportLog>): Promise<void> {
  const supabase = createClient();
  const update: Record<string, unknown> = {};
  if (patch.department !== undefined) update.department  = patch.department;
  if (patch.category   !== undefined) update.category    = patch.category;
  if (patch.title      !== undefined) update.title       = patch.title;
  if (patch.hours      !== undefined) update.hours       = patch.hours;
  if (patch.date       !== undefined) update.date        = patch.date;
  if (patch.week       !== undefined) update.week        = patch.week;
  if (patch.notes      !== undefined) update.notes       = patch.notes;
  if (patch.deletedAt  !== undefined) update.deleted_at  = patch.deletedAt;
  const { error } = await supabase.from('support_logs').update(update).eq('id', id);
  if (error) throw new Error(error.message);
}

// Fields tracked for change history — label shown in the history panel.
const TRACKED_FIELDS: { key: keyof ProcurementRecord; label: string; format?: (v: unknown) => string }[] = [
  { key: 'status',    label: 'Status' },
  { key: 'amountUsd', label: 'Amount (USD)', format: v => `$${Number(v).toLocaleString()}` },
  { key: 'notes',     label: 'Notes' },
  { key: 'date',      label: 'Date' },
  { key: 'category',  label: 'Category' },
  { key: 'supplier',  label: 'Supplier' },
  { key: 'poNumber',  label: 'PO Number' },
];

type ProcurementHistoryEntry = {
  id: string;
  recordId: string;
  changedAt: string;
  changedBy: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
};

async function insertProcurementHistoryRows(
  recordId: string,
  oldRecord: ProcurementRecord,
  patch: Partial<ProcurementRecord>,
  changedBy: string,
): Promise<void> {
  const supabase = createClient();
  const rows: {
    record_id: string; changed_by: string; field_name: string; old_value: string | null; new_value: string | null;
  }[] = [];

  for (const { key, label, format } of TRACKED_FIELDS) {
    const oldVal = oldRecord[key];
    const newVal = patch[key];
    if (newVal === undefined) continue;
    const fmt = format ?? String;
    const oldStr = oldVal != null ? fmt(oldVal) : null;
    const newStr = newVal != null ? fmt(newVal) : null;
    if (oldStr === newStr) continue;
    rows.push({ record_id: recordId, changed_by: changedBy, field_name: label, old_value: oldStr, new_value: newStr });
  }

  if (rows.length === 0) return;
  const { error } = await supabase.from('procurement_history').insert(rows);
  if (error) console.error('history insert:', error.message);
}

async function fetchProcurementHistory(recordId: string): Promise<ProcurementHistoryEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('procurement_history')
    .select('*')
    .eq('record_id', recordId)
    .order('changed_at', { ascending: false });
  if (error) { console.error('fetchHistory:', error.message); return []; }
  return (data ?? []).map(row => ({
    id:        String(row.id),
    recordId:  String(row.record_id),
    changedAt: String(row.changed_at),
    changedBy: String(row.changed_by ?? ''),
    fieldName: String(row.field_name),
    oldValue:  row.old_value  != null ? String(row.old_value)  : null,
    newValue:  row.new_value  != null ? String(row.new_value)  : null,
  }));
}

async function updateProcurementInDB(
  id: string,
  patch: Partial<ProcurementRecord>,
  oldRecord?: ProcurementRecord,
  changedBy?: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('procurement_records')
    .update({
      po_number:     patch.poNumber ?? '',
      supplier:      patch.supplier,
      amount_usd:    patch.amountUsd,
      category:      patch.category,
      status:        patch.status,
      notes:         patch.notes,
      activity_date:
        patch.date && /^\d{4}-\d{2}-\d{2}$/.test(patch.date)
          ? patch.date
          : new Date().toISOString().slice(0, 10),
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
  if (oldRecord && changedBy) {
    await insertProcurementHistoryRows(id, oldRecord, patch, changedBy);
  }
}

async function updateOperationsInDB(id: string, patch: Partial<OperationsRecord>): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('operations_records')
    .update({
      category:      patch.category,
      quantity:      patch.quantity,
      status:        patch.status,
      notes:         patch.notes,
      activity_date: patch.date,
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Procurement soft-delete (RPC) ────────────────────────────────────────
// Uses a SECURITY DEFINER Postgres function so the UPDATE bypasses the SELECT
// policy (deleted_at IS NULL).  Permission is enforced inside the function:
// only the record creator, the selected employee, or an admin may delete.

async function softDeleteProcurementRecord(
  id: string,
  reason: string
): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('soft_delete_procurement_record', {
    record_id: id,
    reason:    reason || null,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Delete failed: no confirmation returned from server.');
}
async function softDeleteOperationsRecord(
  id: string
): Promise<void> {
  const supabase = createClient();

 const { error } = await supabase
  .from('operations_records')
  .update({
    deleted_at: new Date().toISOString()
  })
  .eq('id', id);

  if (error) throw new Error(error.message);
}
// ─── File Attachments ──────────────────────────────────────────────────────
// Bucket: opspulse-attachments (public read, authenticated write)
// Table:  record_attachments (id, record_type, record_id, file_name, file_path, file_size, uploaded_by, created_at)

type RecordAttachment = {
  id: string;
  recordType: 'support_log' | 'procurement' | 'operations';
  recordId: string;
  fileName: string;
  filePath: string;
  fileSize?: number;
  uploadedBy?: string;
  createdAt?: string;
};

async function uploadAttachmentFile(
  file: File,
  recordType: 'support_log' | 'procurement' | 'operations',
  recordId: string,
  uploadedBy?: string
): Promise<RecordAttachment> {
  const supabase = createClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${recordType}/${recordId}/${safeName}`;
  const { error: uploadErr } = await supabase.storage
    .from('opspulse-attachments')
    .upload(path, file, { upsert: true });
  if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);
  const { data, error: dbErr } = await supabase
    .from('record_attachments')
    .insert({ record_type: recordType, record_id: recordId, file_name: file.name, file_path: path, file_size: file.size, uploaded_by: uploadedBy ?? null })
    .select('id')
    .single();
  if (dbErr) throw new Error(`Attachment record failed: ${dbErr.message}`);
  return { id: String(data.id), recordType, recordId, fileName: file.name, filePath: path, fileSize: file.size, uploadedBy };
}

async function fetchAttachmentsForRecord(recordType: string, recordId: string): Promise<RecordAttachment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('record_attachments')
    .select('*')
    .eq('record_type', recordType)
    .eq('record_id', recordId)
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchAttachments:', error.message); return []; }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    recordType: String(r.record_type) as RecordAttachment['recordType'],
    recordId: String(r.record_id),
    fileName: String(r.file_name),
    filePath: String(r.file_path),
    fileSize: r.file_size != null ? Number(r.file_size) : undefined,
    uploadedBy: r.uploaded_by ? String(r.uploaded_by) : undefined,
    createdAt: r.created_at ? String(r.created_at) : undefined,
  }));
}

function getAttachmentPublicUrl(filePath: string): string {
  const supabase = createClient();
  return supabase.storage.from('opspulse-attachments').getPublicUrl(filePath).data.publicUrl;
}

async function removeAttachment(id: string, filePath: string): Promise<void> {
  const supabase = createClient();
  await supabase.storage.from('opspulse-attachments').remove([filePath]);
  const { error } = await supabase.from('record_attachments').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Money display helpers ─────────────────────────────────────────────────

interface MoneyDisplay {
  primary:     string;   // e.g. "$1,200"
  secondary?:  string;   // e.g. "₪4,400 ILS" — only when currency ≠ USD
  isFallback?: boolean;  // true = estimated exchange rate
}

function formatMoney(record: {
  amountUsd?: number;
  originalAmount?: number;
  originalCurrency?: string;
  exchangeRate?: number;
}): MoneyDisplay {
  const usd = record.amountUsd ?? 0;
  const primary = `$${usd.toLocaleString()}`;
  const orig = record.originalCurrency?.toUpperCase() ?? 'USD';
  if (orig === 'USD' || !record.originalAmount) return { primary };
  const sym = currencySymbol(orig);
  return {
    primary,
    secondary:  `${sym}${record.originalAmount.toLocaleString()} ${orig}`,
    isFallback: !record.exchangeRate,
  };
}

// Compact inline display for tables: "$1,200" with tooltip on hover
function MoneyCell({ record }: { record: { amountUsd?: number; originalAmount?: number; originalCurrency?: string; exchangeRate?: number } }) {
  const m = formatMoney(record);
  return (
    <span title={m.secondary ? `Original: ${m.secondary}${m.isFallback ? ' (estimated rate)' : ''}` : undefined}
      style={{ fontWeight: 700, color: (record.amountUsd ?? 0) > 0 ? 'var(--color-completed)' : 'var(--color-muted)', whiteSpace: 'nowrap' }}>
      {(record.amountUsd ?? 0) > 0 ? m.primary : '—'}
      {m.secondary && (
        <span style={{ display:'block', fontSize:10, fontWeight:500, color:'var(--color-muted)', marginTop:1 }}>
          {m.secondary}{m.isFallback ? ' ⚠' : ''}
        </span>
      )}
    </span>
  );
}

const pages = [
  'Executive Dashboard', 'Team Contributions','Procurement', 'Operations',
  'Cross Functional Support', 'Weekly Highlights', 'Activity Feed', 'Add Weekly Activity',
];

type KPIItem = { label: string; value: string; note: string; priority: number };

// Returns the Israeli business week tag for a YYYY-MM-DD date string, e.g. "W24".
// Israeli week: Sunday = start, Saturday = end.
// Year assignment uses Thursday of the week (same as ISO).
function getWeekTag(dateStr: string): string {
  const d   = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  // Thursday of this Sunday-start week
  const thu = new Date(d);
  thu.setDate(d.getDate() - d.getDay() + 4);
  const year    = thu.getFullYear();
  // Sunday of this week
  const sun = new Date(d);
  sun.setDate(d.getDate() - d.getDay());
  // Sunday of the first week of `year`
  const jan1    = new Date(year, 0, 1);
  const jan1Sun = new Date(jan1);
  jan1Sun.setDate(jan1.getDate() - jan1.getDay());
  const weekNum = Math.round((sun.getTime() - jan1Sun.getTime()) / (7 * 86400000)) + 1;
  return `W${String(weekNum).padStart(2, '0')}`;
}

const SUPPORT_DEPARTMENTS = [
  'R&D', 'Product Design', 'Production', 'Procurement', 'Operations',
  'Logistics', 'QA', 'Sales', 'Customer Success', 'Finance', 'HR',
  'Marketing', 'IT', 'Management', 'Defence', 'Other',
] as const;

// Split a comma-joined department string into an array of trimmed names.
function parseDepts(department: string): string[] {
  return department.split(',').map(d => d.trim()).filter(Boolean);
}

// Derive support chart data from logs; a log touching N departments counts toward each.
function buildSupportByDept(logs: SupportLog[]): { name: string; hours: number }[] {
  const map: Record<string, number> = {};
  logs.forEach(l => {
    parseDepts(l.department).forEach(dept => {
      map[dept] = (map[dept] || 0) + l.hours;
    });
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, hours]) => ({ name, hours }));
}

// ─── Base components ───────────────────────────────────────────────────────

function KPIGrid({ items, onKpiClick }: { items: KPIItem[]; onKpiClick: (item: KPIItem) => void }) {
  return (
    <div className="grid kpis">
      {items.map(item => (
        <div
          className={`card kpi-p${item.priority} kpi-clickable`}
          key={item.label}
          onClick={() => onKpiClick(item)}
          role="button" tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && onKpiClick(item)}
        >
          <div className="kpi-label">{item.label}</div>
          <div className="kpi-value">{item.value}</div>
          <div className="kpi-note">{item.note}</div>
        </div>
      ))}
    </div>
  );
}

const FILTER_YEARS = (() => {
  const y = new Date().getFullYear();
  return [y - 1, y, y + 1].filter(x => x >= 2024);
})();

function HistoricalTimeFilter({ value, onChange }: { value: TimeFilter; onChange: (tf: TimeFilter) => void }) {
  const set = (patch: Partial<TimeFilter>) => onChange({ ...value, ...patch });
  return (
    <div className="hist-filter">
      <div className="time-filter">
        {(['week', 'month', 'quarter'] as PeriodType[]).map(pt => (
          <button key={pt} className={value.periodType === pt ? 'active' : ''} onClick={() => set({ periodType: pt })}>
            {pt.charAt(0).toUpperCase() + pt.slice(1)}
          </button>
        ))}
      </div>

      <select className="hist-select" value={value.selectedYear} onChange={e => set({ selectedYear: +e.target.value })}>
        {FILTER_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
      </select>

      {value.periodType === 'week' && (
        <select className="hist-select" value={value.selectedWeek} onChange={e => set({ selectedWeek: +e.target.value })}>
          {Array.from({ length: 53 }, (_, i) => i + 1).map(w => (
            <option key={w} value={w}>W{String(w).padStart(2, '0')}</option>
          ))}
        </select>
      )}

      {value.periodType === 'month' && (
        <select className="hist-select" value={value.selectedMonth} onChange={e => set({ selectedMonth: +e.target.value })}>
          {MONTH_NAMES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
      )}

      {value.periodType === 'quarter' && (
        <div className="time-filter">
          {[1, 2, 3, 4].map(q => (
            <button key={q} className={value.selectedQuarter === q ? 'active' : ''} onClick={() => set({ selectedQuarter: q })}>
              Q{q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Shell({ page, setPage, timeFilter, onTimeFilterChange, authEmail, onSignOut, onSearchOpen, children }: {
  page: string; setPage: (p: string) => void;
  timeFilter: TimeFilter; onTimeFilterChange: (tf: TimeFilter) => void;
  authEmail?: string;
  onSignOut?: () => void;
  onSearchOpen?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="shell">
      <aside className="sidebar">
        {/* Orca AI logo — public/orca-logo.png */}
        <img
          src="/orca-logo.png"
          alt="Orca AI"
          className="orca-logo-img"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div className="brand-block">
          <span className="brand-orca">ORCA</span>
          <span className="brand-sep">·</span>
          <span className="brand-product">OpsPulse</span>
        </div>
        <div className="tagline">Orca Operations Platform</div>
        <div className="nav">
          {pages.map(p => (
            <button
              key={p}
              className={[p === page ? 'active' : '', p === 'Team Contributions' ? 'nav-contrib' : ''].filter(Boolean).join(' ')}
              onClick={() => setPage(p)}
            >{p}</button>
          ))}
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <div>
            <b style={{ fontSize: 16 }}>{page}</b>
            <div className="small">Orca Operations Intelligence Platform</div>
          </div>
          <div className="topbar-right">
            {onSearchOpen && (
              <button
                className="search-topbar-btn"
                onClick={onSearchOpen}
                title="Global search (⌘K)"
              >
                🔍 Search
              </button>
            )}
            <HistoricalTimeFilter value={timeFilter} onChange={onTimeFilterChange} />
            <span className="badge">{getTimeFilterLabel(timeFilter)}</span>
            {DEMO_MODE && <span className="badge badge-demo">Demo</span>}
            {!DEMO_MODE && authEmail && (
              <div className="auth-user">
                <span className="small auth-email">{authEmail}</span>
                <button className="signout-btn" onClick={onSignOut}>Sign out</button>
              </div>
            )}
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

// ─── KPI Detail Panel ──────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  delivered: 'status-completed', completed: 'status-completed',
  paid: 'status-completed', resolved: 'status-completed', approved: 'status-completed',
  'in-progress': 'status-in-progress', 'in-transit': 'status-in-progress',
  'pending-approval': 'status-in-progress', pending: 'status-in-progress',
  'customs-hold': 'status-blocked',
};

function KPIDetailPanel({ kpi, timeFilter, onClose }: { kpi: DashboardKpi; timeFilter: TimeFilter; onClose: () => void }) {
  const period      = timeFilterToPeriod(timeFilter);
  const lookupKey   = kpi.kpiRecordKey ?? kpi.label;
  const records: KPIRecord[] = kpiRecords[lookupKey]?.[period] ?? [];
  const periodLabel = getTimeFilterLabel(timeFilter);
  const counterpartyHeader = records[0]?.counterpartyType ?? 'Counterparty';

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <div className="detail-panel" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <div>
            <h3>{kpi.label}</h3>
            <div className="small" style={{ marginTop: 4 }}>{records.length} record{records.length !== 1 ? 's' : ''} · {periodLabel}</div>
          </div>
          <button className="panel-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="panel-body">
          {records.length === 0 ? (
            <div className="panel-empty"><div className="panel-empty-icon">📋</div><div>No records for this period</div></div>
          ) : (
            <table className="record-table">
              <thead>
                <tr>
                  <th>Ref</th><th>Name</th>
                  {records.some(r => r.counterparty) && <th>{counterpartyHeader}</th>}
                  <th>Owner</th><th>Status</th><th>Priority</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td><span className="rec-id">{r.id}</span></td>
                    <td>
                      <div className="rec-name">{r.name}</div>
                      {r.notes && <div className="rec-notes">{r.notes}</div>}
                    </td>
                    {records.some(rec => rec.counterparty) && (
                      <td><span className="rec-counterparty">{r.counterparty ?? '—'}</span></td>
                    )}
                    <td>{r.owner}</td>
                    <td><span className={`status-badge ${STATUS_COLORS[r.status] ?? 'status-in-progress'}`}>{r.status.replace(/-/g, ' ')}</span></td>
                    <td><span className={`priority-label priority-${r.priority}`}><span className="priority-dot" />{r.priority}</span></td>
                    <td><span className="small">{r.date}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Team Member Contribution Panel (Last Updates on Executive Dashboard) ──

function TeamMemberPanel({ memberName, timeFilter, allActivities, onClose }: {
  memberName: string; timeFilter: TimeFilter; allActivities: UnifiedActivity[]; onClose: () => void;
}) {
  const { start, end } = getDateRangeForFilter(timeFilter);
  end.setHours(23, 59, 59, 999);
  const activities = allActivities.filter(a => {
    const d = new Date(a.date + 'T00:00:00');
    return a.employeeName === memberName && d >= start && d <= end;
  });

  // Per-type counts for the header summary
  const typeCounts: Record<string, number> = {};
  for (const a of activities) typeCounts[a.type] = (typeCounts[a.type] ?? 0) + 1;
  const headerSummary = Object.entries(typeCounts).map(([t, n]) => `${n} ${t}`).join(' · ');

  const typeColor: Record<string, string> = {
    support: 'var(--color-completed)', procurement: 'var(--color-warning)', operations: 'var(--color-accent)',
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <div className="detail-panel" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <div>
            <h3>{memberName}</h3>
            <div className="small" style={{ marginTop: 4 }}>
              {activities.length} {activities.length === 1 ? 'activity' : 'activities'}{headerSummary ? ` · ${headerSummary}` : ''} · {getTimeFilterLabel(timeFilter)}
            </div>
          </div>
          <button className="panel-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="panel-body">
          {activities.length === 0 ? (
            <div className="panel-empty">
              <div className="panel-empty-icon">📊</div>
              <div>No contributions logged for this period</div>
            </div>
          ) : (
            <div>
              <div className="task-section-header" style={{ marginBottom: 8 }}>
                <span className="task-section-title">Activity Log</span>
                <span className="task-count">{activities.length}</span>
              </div>
              <table className="record-table">
                <thead><tr><th>Type</th><th>Activity</th><th>Detail</th><th>Date</th></tr></thead>
                <tbody>
                  {activities.map(a => (
                    <tr key={a.id}>
                      <td>
                        <span className="pill" style={{ fontSize: 10, color: typeColor[a.type] ?? 'var(--color-muted)', padding: '2px 6px' }}>
                          {a.type}
                        </span>
                      </td>
                      <td>
                        <div className="rec-name">{a.title}</div>
                        {a.notes && <div className="rec-notes">{a.notes}</div>}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {a.amountUsd != null && a.amountUsd > 0 && <MoneyCell record={{ amountUsd: a.amountUsd, originalAmount: a.originalAmount, originalCurrency: a.originalCurrency }} />}
                        {a.quantity   != null && <span style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{a.quantity} units</span>}
                        {a.hours      != null && a.hours > 0 && <span style={{ fontWeight: 700, color: 'var(--color-completed)' }}>{fmtHours(a.hours)}h</span>}
                      </td>
                      <td><span className="small">{a.date}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Employee Contribution Panel (Team Contributions page) ─────────────────

function EmployeePanel({ member, timeFilter, supportLogs, onClose }: {
  member: TeamMember; timeFilter: TimeFilter; supportLogs: SupportLog[]; onClose: () => void;
}) {
  // Match by name for compatibility with both slug-id and email-id records
  const logs = filterLogsByTimeFilter(supportLogs, timeFilter).filter(l => l.employeeName === member.name);
  const hours = logs.reduce((s, l) => s + l.hours, 0);
  const depts = Array.from(new Set(logs.flatMap(l => parseDepts(l.department))));
  const byDept = buildSupportByDept(logs);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <div className="detail-panel" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <div>
            <h3>{member.name}</h3>
            <div className="small" style={{ marginTop: 2 }}>{member.role}</div>
            <div className="small" style={{ marginTop: 4 }}>
              {fmtHours(hours)}h · {logs.length} activities · {depts.length} dept{depts.length !== 1 ? 's' : ''} · {getTimeFilterLabel(timeFilter)}
            </div>
          </div>
          <button className="panel-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="panel-body">
          {logs.length === 0 ? (
            <div className="panel-empty">
              <div className="panel-empty-icon">📊</div>
              <div>No contributions logged for this period</div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 20 }}>
                <div className="task-section-header" style={{ marginBottom: 8 }}>
                  <span className="task-section-title">Hours by Department</span>
                </div>
                {byDept.map(({ name, hours: h }) => (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,.05)', fontSize: 13 }}>
                    <span>{name}</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-completed)' }}>{fmtHours(h)}h</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="task-section-header" style={{ marginBottom: 8 }}>
                  <span className="task-section-title">Contribution History</span>
                  <span className="task-count">{logs.length}</span>
                </div>
                <table className="record-table">
                  <thead><tr><th>Activity</th><th>Department</th><th>Hours</th><th>Date</th></tr></thead>
                  <tbody>
                    {logs.map(l => (
                      <tr key={l.id}>
                        <td>
                          <div className="rec-name">{l.title}</div>
                          {l.notes && <div className="rec-notes">{l.notes}</div>}
                        </td>
                        <td>{parseDepts(l.department).map(d => <span key={d} className="pill" style={{ fontSize: 11, padding: '2px 6px', marginRight: 3 }}>{d}</span>)}</td>
                        <td style={{ fontWeight: 700, color: 'var(--color-completed)', whiteSpace: 'nowrap' }}>{fmtHours(l.hours)}h</td>
                        <td><span className="small">{l.date}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Team Contributions page ───────────────────────────────────────────────

function TeamContributions({ timeFilter, supportLogs, activeTeamMembers }: { timeFilter: TimeFilter; supportLogs: SupportLog[]; activeTeamMembers: TeamMember[] }) {
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const filtered = filterLogsByTimeFilter(supportLogs, timeFilter);

  const memberStats = activeTeamMembers.map(m => {
    // Match by name — works for both slug-id (legacy) and email-id (Supabase) records
    const logs = filtered.filter(l => l.employeeName === m.name);
    const hours = logs.reduce((s, l) => s + l.hours, 0);
    const depts = Array.from(new Set(logs.flatMap(l => parseDepts(l.department))));
    const lastLog = logs[0];
    return { member: m, hours, activities: logs.length, depts, lastLog };
  }).filter(s => s.activities > 0);

  const totalHours = filtered.reduce((s, l) => s + l.hours, 0);
  const totalActivities = filtered.length;
  const activeMembersCount = memberStats.length;
  const deptCount = Array.from(new Set(filtered.flatMap(l => parseDepts(l.department)))).length;

  return (
    <>
      {selectedMember && (
        <EmployeePanel member={selectedMember} timeFilter={timeFilter} supportLogs={supportLogs} onClose={() => setSelectedMember(null)} />
      )}

      <div className="page-header">
        <h2>Team Contributions</h2>
        <div className="small">Operations team impact · {getTimeFilterLabel(timeFilter)}</div>
      </div>

      <div className="grid kpis">
        <div className="card kpi-p1">
          <div className="kpi-label">Total Support Hours</div>
          <div className="kpi-value">{fmtHours(totalHours)}h</div>
          <div className="kpi-note">Team combined output</div>
        </div>
        <div className="card kpi-p1">
          <div className="kpi-label">Activities Logged</div>
          <div className="kpi-value">{totalActivities}</div>
          <div className="kpi-note">Completed contributions</div>
        </div>
        <div className="card kpi-p2">
          <div className="kpi-label">Active Contributors</div>
          <div className="kpi-value">{activeMembersCount}</div>
          <div className="kpi-note">Members with activity</div>
        </div>
        <div className="card kpi-p2">
          <div className="kpi-label">Departments Supported</div>
          <div className="kpi-value">{deptCount}</div>
          <div className="kpi-note">Cross-functional reach</div>
        </div>
      </div>

      {memberStats.length === 0 ? (
        <div className="card"><div className="panel-empty"><div className="panel-empty-icon">📊</div><div>No contributions logged for this period</div></div></div>
      ) : (
        <div className="contrib-grid">
          {memberStats.map(({ member, hours, activities, depts, lastLog }) => (
            <div key={member.id} className="contrib-card" onClick={() => setSelectedMember(member)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setSelectedMember(member)}>
              <div className="contrib-header">
                <div className="contrib-name">{member.name}</div>
                <div className="small">{member.role}</div>
              </div>
              <div className="contrib-stats">
                <div className="contrib-stat">
                  <div className="contrib-stat-value">{fmtHours(hours)}h</div>
                  <div className="contrib-stat-label">Hours</div>
                </div>
                <div className="contrib-stat">
                  <div className="contrib-stat-value">{activities}</div>
                  <div className="contrib-stat-label">Activities</div>
                </div>
                <div className="contrib-stat">
                  <div className="contrib-stat-value">{depts.length}</div>
                  <div className="contrib-stat-label">Depts</div>
                </div>
              </div>
              <div className="contrib-depts">
                {depts.slice(0, 3).map(d => <span key={d} className="pill" style={{ fontSize: 11 }}>{d}</span>)}
              </div>
              {lastLog && <div className="contrib-last small">Latest: {lastLog.title}</div>}
              <button className="last-updates-btn" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}>
                View Contributions ↗
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ─── Delta helper ──────────────────────────────────────────────────────────

function formatDelta(current: number, previous: number, fmt?: (n: number) => string): {
  text: string; isPositive: boolean; isNeutral: boolean;
} {
  if (current === previous) return { text: '—', isPositive: false, isNeutral: true };
  const diff = current - previous;
  const abs  = Math.abs(diff);
  const sign = diff > 0 ? '+' : '−';
  const str  = fmt ? fmt(abs) : String(parseFloat(abs.toFixed(1)));
  return { text: `${sign}${str} vs prev`, isPositive: diff > 0, isNeutral: false };
}

// ─── Executive Summary Card ────────────────────────────────────────────────

function ExecSummaryCard({ currentLogs, previousLogs, currentProc, previousProc }: {
  currentLogs:  SupportLog[];
  previousLogs: SupportLog[];
  currentProc:  ProcurementRecord[];
  previousProc: ProcurementRecord[];
}) {
  const c = {
    activities: currentLogs.length,
    hours:      currentLogs.reduce((s, l) => s + l.hours, 0),
    po:         currentProc.filter(r => r.category === 'PO Created').length,
    emergency:  currentProc.filter(r => r.category === 'Emergency Request').length,
    payments:   currentProc.filter(r => r.category === 'Supplier Payment').length,
  };
  const p = {
    activities: previousLogs.length,
    hours:      previousLogs.reduce((s, l) => s + l.hours, 0),
    po:         previousProc.filter(r => r.category === 'PO Created').length,
    emergency:  previousProc.filter(r => r.category === 'Emergency Request').length,
    payments:   previousProc.filter(r => r.category === 'Supplier Payment').length,
  };
  const metrics: { label: string; cur: number; prev: number; fmt?: (n: number) => string; deltaFmt?: (n: number) => string }[] = [
    { label: 'Activities',    cur: c.activities, prev: p.activities },
    { label: 'Support Hours', cur: c.hours,      prev: p.hours,     fmt: (n: number) => `${fmtHours(n)}h`, deltaFmt: (n: number) => `${fmtHours(n)}h` },
    { label: 'PO Created',    cur: c.po,         prev: p.po        },
    { label: 'Emergency',     cur: c.emergency,  prev: p.emergency  },
    { label: 'Payments',      cur: c.payments,   prev: p.payments   },
  ];
  return (
    <div className="card exec-summary" style={{ marginBottom: 18 }}>
      <div className="exec-summary-title">Period Summary</div>
      <div className="exec-summary-grid">
        {metrics.map(m => {
          const d = formatDelta(m.cur, m.prev, m.deltaFmt);
          const cls = `exec-delta ${d.isNeutral ? 'exec-delta-neutral' : d.isPositive ? 'exec-delta-up' : 'exec-delta-down'}`;
          return (
            <div key={m.label} className="exec-summary-item">
              <div className="exec-summary-label">{m.label}</div>
              <div className="exec-summary-value">{m.fmt ? m.fmt(m.cur) : m.cur}</div>
              <div className={cls}>{d.text}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Executive Dashboard ───────────────────────────────────────────────────

function Executive({ timeFilter, supportLogs, activeTeamMembers, allActivities }: { timeFilter: TimeFilter; supportLogs: SupportLog[]; activeTeamMembers: TeamMember[]; allActivities: UnifiedActivity[] }) {
  const [selectedKpi,          setSelectedKpi]          = useState<DashboardKpi | null>(null);
  const [selectedMember,       setSelectedMember]       = useState<string | null>(null);
  const [selectedProcCategory, setSelectedProcCategory] = useState<ProcurementCategory | null>(null);
  const [selectedOpsCategory,  setSelectedOpsCategory]  = useState<OperationsCategory | null>(null);
  const [procStatusFilter,     setProcStatusFilter]     = useState<'PO Arrived' | 'PO Issued' | null>(null);
  const [execViewingRecord,    setExecViewingRecord]    = useState<ProcurementRecord | null>(null);
  const [procRecords,     setProcRecords]     = useState<ProcurementRecord[]>([]);
  const [prevProcRecords, setPrevProcRecords] = useState<ProcurementRecord[]>([]);
  const [opsRecords,      setOpsRecords]      = useState<OperationsRecord[]>([]);
  const [prevOpsRecords,  setPrevOpsRecords]  = useState<OperationsRecord[]>([]);

  // Maps the three Procurement Activity KPI labels to ProcurementCategory values.
  // Any label in this map routes to ProcurementDrillDown (live data) instead of KPIDetailPanel (mock).
  const PROC_DRILL_MAP: Partial<Record<string, ProcurementCategory>> = {};
  const PROC_STATUS_MAP: Record<string, 'PO Arrived' | 'PO Issued'> = {
    'Goods Received': 'PO Arrived',
    'Goods Pending':  'PO Issued',
  };
  const OPS_DRILL_MAP: Partial<Record<string, OperationsCategory>> = {
    'Systems Shipped':         'Systems Shipped',
    'Installations Completed': 'Installations Completed',
    'Spares Shipped':          'Spares Shipped',
  };

  const openKpi = (kpi: DashboardKpi) => {
    setSelectedMember(null);
    const procStatus = PROC_STATUS_MAP[kpi.label];
    const procCat    = PROC_DRILL_MAP[kpi.label];
    const opsCat     = OPS_DRILL_MAP[kpi.label];
    if (procStatus) {
      setSelectedKpi(null); setSelectedProcCategory(null); setSelectedOpsCategory(null);
      setProcStatusFilter(procStatus);
    } else if (procCat) {
      setSelectedKpi(null); setSelectedOpsCategory(null);
      setSelectedProcCategory(procCat);
    } else if (opsCat) {
      setSelectedKpi(null); setSelectedProcCategory(null);
      setSelectedOpsCategory(opsCat);
    } else {
      setSelectedProcCategory(null); setSelectedOpsCategory(null);
      setSelectedKpi(kpi);
    }
  };
  const openMember = (name: string) => { setSelectedKpi(null); setSelectedProcCategory(null); setSelectedOpsCategory(null); setSelectedMember(name); };

  // Fetch current + previous period procurement in one effect
  useEffect(() => {
    const prev = getPreviousPeriod(timeFilter);

    const filterMock = (tf: typeof timeFilter) => {
      const { start, end } = getDateRangeForFilter(tf);
      end.setHours(23, 59, 59, 999);
      return mockProcurementRecords.filter(r => {
        if (!r.date) return false;
        const d = new Date(r.date + 'T00:00:00');
        return d >= start && d <= end;
      });
    };

    const filterMockOps = (tf: typeof timeFilter) => {
      const { start, end } = getDateRangeForFilter(tf);
      end.setHours(23, 59, 59, 999);
      return mockOperationsRecords.filter(r => {
        if (!r.date) return false;
        const d = new Date(r.date + 'T00:00:00');
        return d >= start && d <= end;
      });
    };

    if (DEMO_MODE) {
      setProcRecords(filterMock(timeFilter));
      setPrevProcRecords(filterMock(prev));
      setOpsRecords(filterMockOps(timeFilter));
      setPrevOpsRecords(filterMockOps(prev));
    } else {
      fetchProcurementFromDB(timeFilter).then(setProcRecords);
      fetchProcurementFromDB(prev).then(setPrevProcRecords);
      fetchOperationsFromDB(timeFilter).then(setOpsRecords);
      fetchOperationsFromDB(prev).then(setPrevOpsRecords);
    }
  }, [timeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive live Procurement Activity KPI values — status-based financial totals
  const procArrived    = procRecords.filter(r => r.status === 'PO Arrived');
  const procIssued     = procRecords.filter(r => r.status === 'PO Issued');
  const procTotalAmt   = procRecords.reduce((s, r) => s + r.amountUsd, 0);
  const procArrivedAmt = procArrived.reduce((s, r) => s + r.amountUsd, 0);
  const procIssuedAmt  = procIssued.reduce((s, r) => s + r.amountUsd, 0);
  const procKpiOverrides: Record<string, { value: string; note: string }> = {
    'Total Procurement': { value: fmtMoney(procTotalAmt),   note: `${procRecords.length} records`       },
    'Goods Received':    { value: fmtMoney(procArrivedAmt), note: `${procArrived.length} POs arrived`   },
    'Goods Pending':     { value: fmtMoney(procIssuedAmt),  note: `${procIssued.length} POs issued`     },
  };

  // Previous-period procurement deltas (amount-based)
  const prevProcArrived    = prevProcRecords.filter(r => r.status === 'PO Arrived');
  const prevProcIssued     = prevProcRecords.filter(r => r.status === 'PO Issued');
  const prevProcTotalAmt   = prevProcRecords.reduce((s, r) => s + r.amountUsd, 0);
  const prevProcArrivedAmt = prevProcArrived.reduce((s, r) => s + r.amountUsd, 0);
  const prevProcIssuedAmt  = prevProcIssued.reduce((s, r) => s + r.amountUsd, 0);
  const procDeltaMap: Record<string, ReturnType<typeof formatDelta>> = {
    'Total Procurement': formatDelta(procTotalAmt,   prevProcTotalAmt,   fmtMoney),
    'Goods Received':    formatDelta(procArrivedAmt, prevProcArrivedAmt, fmtMoney),
    'Goods Pending':     formatDelta(procIssuedAmt,  prevProcIssuedAmt,  fmtMoney),
  };

  // Derive live Operations KPI values — quantity sums (not record counts)
  const opsQty = (cat: OperationsCategory) => opsRecords.filter(r => r.category === cat).reduce((s, r) => s + r.quantity, 0);
  const prevOpsQty = (cat: OperationsCategory) => prevOpsRecords.filter(r => r.category === cat).reduce((s, r) => s + r.quantity, 0);
  const opsKpiOverrides: Record<string, { value: string; note: string }> = {
    'Systems Shipped':         { value: String(opsQty('Systems Shipped')),         note: opsQty('Systems Shipped')         > 0 ? `${opsRecords.filter(r => r.category === 'Systems Shipped').length} records`         : 'No records this period' },
    'Installations Completed': { value: String(opsQty('Installations Completed')), note: opsQty('Installations Completed') > 0 ? `${opsRecords.filter(r => r.category === 'Installations Completed').length} records` : 'No records this period' },
    'Spares Shipped':          { value: String(opsQty('Spares Shipped')),           note: opsQty('Spares Shipped')           > 0 ? `${opsRecords.filter(r => r.category === 'Spares Shipped').length} records`           : 'No records this period' },
  };
  const opsDeltaMap: Record<string, ReturnType<typeof formatDelta>> = {
    'Systems Shipped':         formatDelta(opsQty('Systems Shipped'),         prevOpsQty('Systems Shipped')),
    'Installations Completed': formatDelta(opsQty('Installations Completed'), prevOpsQty('Installations Completed')),
    'Spares Shipped':          formatDelta(opsQty('Spares Shipped'),           prevOpsQty('Spares Shipped')),
  };

  // Derive live support metrics from SupportLog
  const filtered       = filterLogsByTimeFilter(supportLogs, timeFilter);
  const prevFiltered   = filterLogsByTimeFilter(supportLogs, getPreviousPeriod(timeFilter));
  const derivedHours   = filtered.reduce((s, l) => s + l.hours, 0);
  const derivedSupport = buildSupportByDept(filtered);

  return (
    <>
      {selectedKpi          && <KPIDetailPanel kpi={selectedKpi} timeFilter={timeFilter} onClose={() => setSelectedKpi(null)} />}
      {selectedProcCategory && <ProcurementDrillDown category={selectedProcCategory} records={procRecords} onClose={() => setSelectedProcCategory(null)} />}
      {selectedOpsCategory  && <OperationsDrillDown category={selectedOpsCategory} records={opsRecords} onClose={() => setSelectedOpsCategory(null)} />}
      {selectedMember       && <TeamMemberPanel memberName={selectedMember} timeFilter={timeFilter} allActivities={allActivities} onClose={() => setSelectedMember(null)} />}
      {procStatusFilter && (
        <ProcurementStatusDrillDown
          label={procStatusFilter === 'PO Arrived' ? 'Goods Received' : 'Goods Pending'}
          status={procStatusFilter}
          records={procRecords}
          onClose={() => setProcStatusFilter(null)}
          onSelectRecord={r => setExecViewingRecord(r)}
        />
      )}
      {execViewingRecord && <ProcurementViewPanel record={execViewingRecord} onClose={() => setExecViewingRecord(null)} />}

      {/* ── Executive Summary ────────────────────────────────────────── */}
      <ExecSummaryCard
        currentLogs={filtered}  previousLogs={prevFiltered}
        currentProc={procRecords} previousProc={prevProcRecords}
      />

      {/* ── Three operational sections ───────────────────────────────── */}
      {dashboardSections.map(section => {
        const accentCls = section.title === 'Production' ? 'section-accent-blue'
          : section.title === 'Operations' ? 'section-accent-green'
          : 'section-accent-orange';
        return (
        <div key={section.title} style={{ marginBottom: 4 }}>
          <div className={`dash-section-header ${accentCls}`}>{section.title}</div>
          <div className="grid three">
            {section.kpis.map(kpi => {
              // Operations + Procurement cards are always clickable via their drill-down maps
              const clickable = Boolean(kpi.kpiRecordKey) || Boolean(PROC_DRILL_MAP[kpi.label]) || Boolean(PROC_STATUS_MAP[kpi.label]) || Boolean(OPS_DRILL_MAP[kpi.label]);
              // Live overrides: Operations quantity sums take priority, then Procurement
              const override     = ({ ...opsKpiOverrides, ...procKpiOverrides })[kpi.label];
              const displayValue = override ? override.value : kpi.value;
              const displayNote  = override ? override.note  : kpi.note;
              return (
                <div
                  key={kpi.label}
                  className={`card${clickable ? ' kpi-clickable' : ''}`}
                  onClick={clickable ? () => openKpi(kpi) : undefined}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onKeyDown={clickable ? e => e.key === 'Enter' && openKpi(kpi) : undefined}
                >
                  <div className="kpi-label">{kpi.label}</div>
                  <div className="kpi-value">{displayValue}</div>
                  <div className="small">{displayNote}</div>
                  {({ ...procDeltaMap, ...opsDeltaMap })[kpi.label] && (() => {
                    const d = ({ ...procDeltaMap, ...opsDeltaMap })[kpi.label];
                    return (
                      <div className={`card-delta ${d.isNeutral ? 'exec-delta-neutral' : d.isPositive ? 'exec-delta-up' : 'exec-delta-down'}`}>
                        {d.text}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
        );
      })}

      {/* ── Live support data ────────────────────────────────────────── */}
      <div className="grid two" style={{ marginTop: 8 }}>
        <div className="card">
          <h2 className="section-title">Team Last Updates</h2>
          <div className="team-pulse-list">
            {(() => {
              // Filter the unified activity stream to the current time period
              const { start, end } = getDateRangeForFilter(timeFilter);
              end.setHours(23, 59, 59, 999);
              const periodActivities = allActivities.filter(a => {
                const d = new Date(a.date + 'T00:00:00');
                return d >= start && d <= end;
              });
              // All team members who have any activity (any type) in the period
              const activeNames = new Set(periodActivities.map(a => a.employeeName));
              const active = activeTeamMembers.filter(m => activeNames.has(m.name));
              if (active.length === 0) {
                return (
                  <div className="panel-empty" style={{ padding: '20px 0 8px' }}>
                    <div className="panel-empty-icon">👤</div>
                    <div>No team updates submitted this period</div>
                  </div>
                );
              }
              return active.map(m => {
                const memberActivities = periodActivities.filter(a => a.employeeName === m.name);
                // Count by type — any future activity type appears automatically
                const typeCounts: Record<string, number> = {};
                for (const a of memberActivities) typeCounts[a.type] = (typeCounts[a.type] ?? 0) + 1;
                const summary = Object.entries(typeCounts)
                  .map(([t, n]) => `${n} ${t}`)
                  .join(' · ');
                return (
                  <div key={m.name} className="team-pulse-item">
                    <span className="pulse-check">✓</span>
                    <div className="pulse-info">
                      <div className="pulse-name">{m.name}</div>
                      {summary && <div className="pulse-summary">{summary}</div>}
                    </div>
                    <button className="last-updates-btn" onClick={() => openMember(m.name)}>
                      Last Updates ↗
                    </button>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">Support Hours by Department</h2>
          {derivedSupport.length === 0 ? (
            <div className="panel-empty" style={{ padding: '32px 0' }}>
              <div className="panel-empty-icon">📊</div>
              <div>No support hours logged for this period</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={derivedSupport} layout="vertical" margin={{ top: 4, right: 54, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.07)" />
                <XAxis type="number" stroke="var(--color-muted)" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" stroke="var(--color-muted)" tick={{ fontSize: 12 }} width={72} />
                <Tooltip contentStyle={{ background: '#0d192b', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10 }} />
                <Bar dataKey="hours" fill="var(--color-completed)" radius={[0, 8, 8, 0]}>
                  <LabelList dataKey="hours" position="right" formatter={(v: unknown) => `${fmtHours(Number(v))}h`} style={{ fill: '#ffffff', fontWeight: 700, fontSize: 12 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Procurement Drill-Down Panel ─────────────────────────────────────────

function ProcurementDrillDown({ category, records, onClose }: {
  category: ProcurementCategory;
  records: ProcurementRecord[];
  onClose: () => void;
}) {
  const filtered  = records.filter(r => r.category === category);
  const totalUsd  = filtered.reduce((s, r) => s + r.amountUsd, 0);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <div className="detail-panel" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <div>
            <h3>{category}</h3>
            <div className="small" style={{ marginTop: 4 }}>
              {filtered.length} record{filtered.length !== 1 ? 's' : ''}
              {totalUsd > 0 && ` · $${totalUsd.toLocaleString()}`}
            </div>
          </div>
          <button className="panel-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="panel-body">
          {filtered.length === 0 ? (
            <div className="panel-empty"><div className="panel-empty-icon">📋</div><div>No records for this period</div></div>
          ) : (
            <table className="record-table">
              <thead>
                <tr><th>PO Number</th><th>Supplier</th><th>Amount</th><th>Owner</th><th>Date</th><th>Status</th></tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td><span className="rec-id">{r.poNumber || '—'}</span></td>
                    <td>
                      <div className="rec-name">{r.supplier}</div>
                      {r.notes && <div className="rec-notes">{r.notes}</div>}
                    </td>
                    <td><MoneyCell record={r} /></td>
                    <td>{r.employeeName}</td>
                    <td><span className="small">{r.date}</span></td>
                    <td>
                      <span className={`status-badge ${r.status === 'PO Arrived' ? 'status-complete' : 'status-open'}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Procurement Entry Form ────────────────────────────────────────────────

// ─── Attachment Widget ────────────────────────────────────────────────────
// Used inside every create/edit form to show existing attachments and pick
// a new file.  The parent form's save() calls uploadAttachmentFile() with
// the resolved recordId after the record is persisted.

function AttachmentWidget({
  recordType, recordId, pendingFile, onPendingFileChange,
}: {
  recordType: 'support_log' | 'procurement' | 'operations';
  recordId?: string;
  pendingFile: File | null;
  onPendingFileChange: (f: File | null) => void;
}) {
  const [attachments, setAttachments] = useState<RecordAttachment[]>([]);
  const [attLoading,  setAttLoading]  = useState(false);

  useEffect(() => {
    if (!recordId || DEMO_MODE) return;
    setAttLoading(true);
    fetchAttachmentsForRecord(recordType, recordId)
      .then(setAttachments)
      .finally(() => setAttLoading(false));
  }, [recordId, recordType]);

  const handleRemove = async (att: RecordAttachment) => {
    if (!confirm(`Delete "${att.fileName}"?`)) return;
    try {
      await removeAttachment(att.id, att.filePath);
      setAttachments(prev => prev.filter(a => a.id !== att.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete attachment.');
    }
  };

  return (
    <div>
      <div className="kpi-label" style={{ marginBottom: 4 }}>Attachment</div>
      {DEMO_MODE ? (
        <div className="form-note">File attachments require production mode (Supabase)</div>
      ) : (
        <>
          {attLoading && <div className="form-note">Loading attachments…</div>}
          {attachments.map(att => (
            <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <a href={getAttachmentPublicUrl(att.filePath)} target="_blank" rel="noreferrer"
                style={{ color: 'var(--color-accent)', fontSize: 12, textDecoration: 'underline' }}>
                📎 {att.fileName}{att.fileSize ? ` (${Math.round(att.fileSize / 1024)}KB)` : ''}
              </a>
              <button onClick={() => handleRemove(att)}
                style={{ background: 'none', border: 'none', color: 'var(--color-critical)', cursor: 'pointer', fontSize: 11, padding: 0 }}>✕</button>
            </div>
          ))}
          {pendingFile ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="small" style={{ color: 'var(--color-completed)' }}>
                📎 {pendingFile.name} — will upload on save
              </span>
              <button onClick={() => onPendingFileChange(null)}
                style={{ background: 'none', border: 'none', color: 'var(--color-critical)', cursor: 'pointer', fontSize: 11, padding: 0 }}>✕</button>
            </div>
          ) : (
            <label style={{ cursor: 'pointer', display: 'inline-block' }}>
              <input type="file" style={{ display: 'none' }}
                onChange={e => onPendingFileChange(e.target.files?.[0] ?? null)} />
              <span style={{
                background: 'rgba(255,255,255,.07)', border: '1px solid var(--color-border)',
                color: '#e8eef7', borderRadius: 10, padding: '7px 14px', fontSize: 13,
              }}>+ Attach file</span>
            </label>
          )}
        </>
      )}
    </div>
  );
}

function ProcurementEntryForm({
  onSave,
  onCancel,
  activeTeamMembers,
  initialRecord
}: {
  onSave: (r: ProcurementRecord) => void;
  onCancel: () => void;
  activeTeamMembers: TeamMember[];
  initialRecord?: ProcurementRecord;
}) {
  const [employeeId, setEmployeeId] = useState(initialRecord?.employeeId ?? '');

const [category, setCategory] = useState<ProcurementCategory>(
  initialRecord?.category ?? PROCUREMENT_CATEGORIES[0]
);

const [poNumber, setPoNumber] = useState(initialRecord?.poNumber ?? '');

const [supplier, setSupplier] = useState(initialRecord?.supplier ?? '');
const [amount, setAmount] = useState(
  initialRecord?.amountUsd?.toString() ?? ''
);

const [currency, setCurrency] = useState('USD');

const [status, setStatus] = useState<ProcurementRecord['status']>(
  initialRecord?.status ?? PROCUREMENT_STATUSES[0]
);

const [notes, setNotes] = useState(
  initialRecord?.notes ?? ''
);

const [date, setDate] = useState(
  initialRecord?.date ?? new Date().toISOString().slice(0, 10)
);
  const [converting,  setConverting]  = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
useEffect(() => {
  console.log('FORM initialRecord:', initialRecord);

  if (!initialRecord) return;
    setEmployeeId(initialRecord.employeeId ?? '');

  setCategory(initialRecord.category ?? PROCUREMENT_CATEGORIES[0]);
  setPoNumber(initialRecord.poNumber ?? '');
  setSupplier(initialRecord.supplier ?? '');
  setAmount((initialRecord.amountUsd ?? '').toString());
  setCurrency('USD');
  setStatus(initialRecord.status ?? PROCUREMENT_STATUSES[0]);
  setNotes(initialRecord.notes ?? '');
  setDate(initialRecord.date ?? new Date().toISOString().slice(0, 10));
}, [initialRecord]);

const save = async () => {
    if (!employeeId)              { alert('Please select an employee.'); return; }
    if (!supplier.trim())         { alert('Supplier is required.'); return; }
    if (category === 'PO Created' && !poNumber.trim()) { alert('PO Number is required for PO Created.'); return; }
    const rawAmount = parseFloat(amount);
    if (amount && isNaN(rawAmount)) { alert('Amount must be a valid number.'); return; }
    const member = activeTeamMembers.find(m => m.id === employeeId);
    if (!member) return;

    setConverting(true);
    let amountUsd = rawAmount || 0;
    let originalAmount: number | undefined;
    let originalCurrency: string | undefined;
    let exchangeRate: number | undefined;
    let exchangeRateDate: string | undefined;

    if (rawAmount > 0 && currency !== 'USD') {
      try {
        const conv = await convertToUsd(rawAmount, currency);
        amountUsd        = conv.usdAmount;
        originalAmount   = rawAmount;
        originalCurrency = currency;
        exchangeRate     = conv.exchangeRate;
exchangeRateDate =
  conv.exchangeRateDate && /^\d{4}-\d{2}-\d{2}$/.test(conv.exchangeRateDate)
    ? conv.exchangeRateDate
    : new Date().toISOString().slice(0, 10);


} catch {
  amountUsd = rawAmount; // fallback: treat as USD
  originalAmount = rawAmount;
  originalCurrency = currency;
  exchangeRate = 1;
  exchangeRateDate = new Date().toISOString().slice(0, 10);
}
    } else if (rawAmount > 0) {
      originalAmount   = rawAmount;
      originalCurrency = 'USD';
      exchangeRate     = 1;
      exchangeRateDate = new Date().toISOString().slice(0, 10);
    }

    setConverting(false);
    const recordId = initialRecord?.id ?? `PR-${Date.now()}`;
    if (pendingFile && !DEMO_MODE) {
      try {
        await uploadAttachmentFile(pendingFile, 'procurement', recordId);
      } catch (err) {
        console.error('Attachment upload failed:', err);
      }
    }
    onSave({
      id:              recordId,
      employeeId,
      employeeName:    member.name,
      poNumber:        poNumber.trim(),
      supplier:        supplier.trim(),
      amountUsd,
      originalAmount,
      originalCurrency,
      exchangeRate,
      exchangeRateDate,
      category,
      status,
      notes:           notes.trim(),
      date: date && /^\d{4}-\d{2}-\d{2}$/.test(date)
  ? date
  : new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <h2 className="section-title">Log Procurement Activity</h2>
      <div className="grid two">
        <div>
          <div className="kpi-label">Employee *</div>
          <select className="input" value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
            <option value="">— Select employee —</option>
            {activeTeamMembers.map(m => <option key={m.id} value={m.id}>{m.name} · {m.role}</option>)}
          </select>
        </div>
        <div>
          <div className="kpi-label">Category *</div>
          <select className="input" value={category} onChange={e => setCategory(e.target.value as ProcurementCategory)}>
            {PROCUREMENT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        {category === 'PO Created' && (
          <div>
            <div className="kpi-label">PO Number *</div>
            <input className="input" value={poNumber} onChange={e => setPoNumber(e.target.value)} placeholder="e.g. PO-4571" />
          </div>
        )}
        <div>
          <div className="kpi-label">Supplier *</div>
          <input className="input" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="e.g. Elektra Components GmbH" />
        </div>
        <div>
          <div className="kpi-label">Amount</div>
          <div style={{ display:'flex', gap:6 }}>
            <input className="input" style={{ flex:1, margin:0 }} type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 12400" />
            <select className="input" style={{ margin:0, width:88 }} value={currency} onChange={e => setCurrency(e.target.value)}>
              {SUPPORTED_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {currency !== 'USD' && amount && !isNaN(parseFloat(amount)) && (
            <div className="form-note">Will be converted to USD at current rate</div>
          )}
        </div>
        <div>
          <div className="kpi-label">Status</div>
          <select className="input" value={status} onChange={e => setStatus(e.target.value as ProcurementRecord['status'])}>
            {PROCUREMENT_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <div className="kpi-label">Activity Date</div>
          <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <div className="kpi-label">Notes</div>
          <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional context or outcome" />
        </div>
        <div>
          <AttachmentWidget
            recordType="procurement"
            recordId={initialRecord?.id}
            pendingFile={pendingFile}
            onPendingFileChange={setPendingFile}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button className="save-button" style={{ marginTop: 0 }} onClick={save} disabled={converting}>
          {converting ? 'Converting…' : 'Save'}
        </button>
        <button onClick={onCancel} style={{ background: 'rgba(255,255,255,.07)', border: '1px solid var(--color-border)', color: '#e8eef7', borderRadius: 12, padding: '11px 20px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>Cancel</button>
      </div>
    </div>
  );
}
// ─── Delete Confirmation Modal ─────────────────────────────────────────────

function DeleteConfirmModal({ title, onConfirm, onCancel }: {
  title:     string;
  onConfirm: (reason: string) => void;
  onCancel:  () => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <>
      <div className="panel-overlay" onClick={onCancel} />
      <div style={{
        position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
        background:'#0d192b', border:'1px solid rgba(239,68,68,.3)', borderRadius:20,
        padding:'28px 28px', width:'min(440px,90vw)', zIndex:200, fontFamily:'inherit',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:16, fontWeight:700, marginBottom:6 }}>Delete record?</div>
        <div className="small" style={{ marginBottom:18 }}>{title}</div>
        <div className="kpi-label" style={{ marginBottom:4 }}>Reason (optional)</div>
        <input className="input" value={reason} onChange={e => setReason(e.target.value)}
          placeholder="e.g. Duplicate, entered in error…" />
        <div style={{ display:'flex', gap:10, marginTop:18 }}>
          <button
            onClick={() => onConfirm(reason)}
            style={{ background:'rgba(239,68,68,.15)', border:'1px solid rgba(239,68,68,.4)', color:'var(--color-critical)', borderRadius:12, padding:'10px 20px', cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:700 }}>
            Delete
          </button>
          <button onClick={onCancel} style={{ background:'rgba(255,255,255,.07)', border:'1px solid var(--color-border)', color:'#e8eef7', borderRadius:12, padding:'10px 20px', cursor:'pointer', fontFamily:'inherit', fontSize:14 }}>
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Procurement Page (live data) ──────────────────────────────────────────

// ─── Procurement Import Panel ──────────────────────────────────────────────

type ImportStep = 'idle' | 'parsing' | 'mapping' | 'preview' | 'importing' | 'done';

function ProcurementImportPanel({ onImport, onClose, activeTeamMembers, authUserEmail }: {
  onImport: (records: MappedRecord<ProcurementRecord>[]) => Promise<void>;
  onClose:  () => void;
  activeTeamMembers: TeamMember[];
  authUserEmail?: string;
}) {
  const [step,        setStep]        = useState<ImportStep>('idle');
  const [rawRows,     setRawRows]     = useState<RawRow[]>([]);
  const [sheets,      setSheets]      = useState<string[]>([]);
  const [sourceType,  setSourceType]  = useState<'pdf' | 'excel' | 'csv'>('csv');
  const [columnMap,   setColumnMap]   = useState<Record<string, string | null>>({});
  const [colMatches,  setColMatches]  = useState<ColumnMatch[]>([]);
  const [preview,     setPreview]     = useState<MappedRecord<ProcurementRecord>[]>([]);
  const [templates,   setTemplates]   = useState<MappingTemplate[]>([]);
  const [saveTplName, setSaveTplName] = useState('');
  const [importResult,setImportResult]= useState<{ success: number; skipped: number } | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [dragOver,    setDragOver]    = useState(false);
  const [debugHeaders,setDebugHeaders]= useState<string[]>([]);
  const [netsuiteDetected, setNetsuiteDetected] = useState(false);

  // Load templates on mount
  useEffect(() => {
    if (DEMO_MODE) return;
    const supabase = createClient();
    fetchTemplates(supabase).then(setTemplates).catch(() => {/* non-critical */});
  }, []);

  // Rebuild preview whenever column map or raw rows change
  useEffect(() => {
    if (rawRows.length === 0) return;
    const meta = {
      sourceFile:    '',
      sourceType,
      importedAt:    new Date().toISOString(),
      importVersion: '1.0' as const,
      extractedRows: rawRows,
    };
    const mapped = rawRows.map((row, i) =>
      mapOraclePORow(row, columnMap, activeTeamMembers, meta, i)
    );
    setPreview(mapped);
  }, [columnMap, rawRows, sourceType, activeTeamMembers]);

  async function handleFile(file: File) {
    setError(null);
    setStep('parsing');
    try {
      const parsed = await parseFile(file);

      setRawRows(parsed.rows);
      setSheets(parsed.sheets ?? []);
      setSourceType(parsed.sourceType);

      // Auto-detect column mappings.
      // If the file looks like a NetSuite export, apply the exact preset map
      // directly so all columns are pre-filled without fuzzy scoring.
      const headers = getHeaders(parsed.rows);
      setDebugHeaders(headers);
      const detected = isNetSuiteExport(headers);
      setNetsuiteDetected(detected);
      if (detected) {
        // Build a full map: preset for known headers, null (skip) for anything else.
        const exactMap: Record<string, string | null> = {};
        for (const h of headers) {
          exactMap[h] = NETSUITE_PO_EXACT_MAP[h] ?? null;
        }
        // Derive colMatches from the exact map so the UI dots show green.
        const exactMatches: ColumnMatch[] = headers.map(h => ({
          sourceColumn: h,
          targetField:  exactMap[h],
          confidence:   exactMap[h] !== undefined ? 'high' : 'unmapped',
        }));
        setColMatches(exactMatches);
        setColumnMap(exactMap);
      } else {
        const matches = detectColumnMappings(headers, ORACLE_PO_RULES);
        setColMatches(matches);
        setColumnMap(columnMatchesToMap(matches));
      }

      setStep(parsed.sourceType === 'pdf' ? 'preview' : 'mapping');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
      setStep('idle');
    }
  }

  function applyTemplate(tpl: MappingTemplate) {
    const map: Record<string, string | null> = { ...columnMap };
    for (const fm of tpl.fieldMappings) {
      if (map[fm.sourceColumn] !== undefined) map[fm.sourceColumn] = fm.targetField;
    }
    setColumnMap(map);
  }

  async function handleImport() {
    setStep('importing');
    try {
      const ready = preview.filter(r => r.data.supplier); // require supplier minimum
      await onImport(ready);
      setImportResult({ success: ready.length, skipped: preview.length - ready.length });
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('preview');
    }
  }

  async function handleSaveTemplate() {
    if (!saveTplName.trim() || DEMO_MODE) return;
    const supabase = createClient();
    const tpl = await saveTemplate(supabase, {
      name:         saveTplName.trim(),
      description:  'Saved from import preview',
      targetSchema: 'procurement',
      fieldMappings: colMatches.map(m => ({ sourceColumn: m.sourceColumn, targetField: m.targetField })),
      createdBy:    authUserEmail ?? '',
    });
    setTemplates(prev => [tpl, ...prev]);
    setSaveTplName('');
  }

  // ── Confidence badge ──────────────────────────────────────────────────────
  const confDot = (level: ColumnMatch['confidence']) => {
    const colors: Record<string, string> = {
      high:    'var(--color-completed)',
      medium:  'var(--color-warning)',
      low:     'rgba(239,68,68,.7)',
      unmapped:'var(--color-muted)',
    };
    return (
      <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%',
        background: colors[level] ?? 'var(--color-muted)', marginRight:6, flexShrink:0 }}
      />
    );
  };

  // ── TARGET_FIELDS dropdown options ────────────────────────────────────────
  const TARGET_FIELDS = [
    { value:'',                 label:'— skip —' },
    { value:'poNumber',         label:'PO Number' },
    { value:'supplier',         label:'Supplier' },
    { value:'date',             label:'PO Date' },
    { value:'amountUsd',        label:'Total Amount (USD)' },
    { value:'originalCurrency', label:'Currency' },
    { value:'status',           label:'Status' },
    { value:'employeeName',     label:'Requester / Owner' },
    { value:'notes',            label:'Notes / Description' },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <div className="detail-panel" style={{ width: 'min(760px, 100vw)' }} onClick={e => e.stopPropagation()}>

        <div className="panel-header">
          <div>
            <h3>Import from file</h3>
            <div className="small" style={{ marginTop: 4 }}>PDF · Excel · CSV — Oracle PO format</div>
          </div>
          <button className="panel-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="panel-body">

          {/* ── IDLE: file drop zone ──────────────────────────────────── */}
          {step === 'idle' && (
            <>
              <div
                className={`import-dropzone${dragOver ? ' import-dropzone-active' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault(); setDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f) handleFile(f);
                }}
                onClick={() => document.getElementById('import-file-input')?.click()}
              >
                <div style={{ fontSize: 32, marginBottom: 10 }}>📂</div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Drop file here or click to browse</div>
                <div className="small">PDF, Excel (.xlsx) or CSV exported from Oracle</div>
                <input
                  id="import-file-input"
                  type="file"
                  accept=".pdf,.xlsx,.xls,.csv"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
              </div>
              {error && <div className="import-error">{error}</div>}
              {templates.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div className="kpi-label" style={{ marginBottom: 6 }}>Saved templates</div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {templates.map(t => (
                      <span key={t.id} className="pill" style={{ cursor:'default', fontSize:11 }}>
                        {t.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── PARSING ───────────────────────────────────────────────── */}
          {step === 'parsing' && (
            <div className="panel-empty">
              <div className="panel-empty-icon">⏳</div>
              <div>Parsing file…</div>
            </div>
          )}

          {/* ── MAPPING: column mapper ────────────────────────────────── */}
          {step === 'mapping' && (
            <>
              <div style={{ marginBottom: 14 }}>
                <div className="section-title" style={{ marginBottom: 8 }}>Column Mapping</div>
                {/* Debug panel — shows which headers were read and whether NetSuite was detected */}
                <details style={{ marginBottom: 10, background: 'rgba(0,0,0,.3)', borderRadius: 6, padding: '6px 10px' }}>
                  <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--color-muted)', userSelect: 'none' }}>
                    {netsuiteDetected
                      ? '✅ NetSuite preset detected — all columns auto-mapped'
                      : `⚠️ NetSuite NOT detected — fuzzy mapping used (${debugHeaders.length} headers read)`}
                  </summary>
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-muted)', fontFamily: 'monospace', lineHeight: 1.7 }}>
                    {debugHeaders.map((h, i) => (
                      <div key={i}>{i + 1}. &quot;{h}&quot;</div>
                    ))}
                  </div>
                </details>
                <div className="small" style={{ marginBottom: 12 }}>
                  Detected {colMatches.length} column{colMatches.length !== 1 ? 's' : ''}. Green = high confidence auto-mapped · Amber = fuzzy match · Red = low confidence · Grey = unmapped.
                </div>
                {templates.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div className="kpi-label" style={{ marginBottom: 4 }}>Apply saved template</div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      {templates.map(t => (
                        <button key={t.id} onClick={() => applyTemplate(t)}
                          style={{ background:'rgba(91,141,238,.12)', border:'1px solid rgba(91,141,238,.3)', color:'var(--color-accent)', borderRadius:8, padding:'4px 12px', cursor:'pointer', fontSize:12, fontFamily:'inherit' }}>
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <table className="record-table" style={{ marginBottom: 0 }}>
                  <thead><tr><th>Source column</th><th>Confidence</th><th>Maps to</th></tr></thead>
                  <tbody>
                    {colMatches.map(m => (
                      <tr key={m.sourceColumn}>
                        <td><span className="rec-id">{m.sourceColumn}</span></td>
                        <td style={{ display:'flex', alignItems:'center' }}>
                          {confDot(m.confidence)}
                          <span className="small" style={{ textTransform:'capitalize' }}>{m.confidence}</span>
                        </td>
                        <td>
                          <select
                            className="hist-select"
                            style={{ width:'100%' }}
                            value={columnMap[m.sourceColumn] ?? ''}
                            onChange={e => setColumnMap(prev => ({ ...prev, [m.sourceColumn]: e.target.value || null }))}
                          >
                            {TARGET_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', marginTop: 8 }}>
                <button className="save-button" style={{ marginTop:0 }} onClick={() => setStep('preview')}>
                  Preview →
                </button>
                <button onClick={onClose} style={{ background:'rgba(255,255,255,.07)', border:'1px solid var(--color-border)', color:'#e8eef7', borderRadius:12, padding:'11px 20px', cursor:'pointer', fontFamily:'inherit', fontSize:14 }}>
                  Cancel
                </button>
                <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
                  <input
                    className="input"
                    style={{ margin:0, width:180 }}
                    placeholder="Save mapping as…"
                    value={saveTplName}
                    onChange={e => setSaveTplName(e.target.value)}
                  />
                  <button
                    onClick={handleSaveTemplate}
                    disabled={!saveTplName.trim()}
                    style={{ background:'rgba(91,141,238,.12)', border:'1px solid rgba(91,141,238,.3)', color:'var(--color-accent)', borderRadius:10, padding:'8px 14px', cursor:'pointer', fontSize:12, fontFamily:'inherit', opacity: saveTplName.trim() ? 1 : 0.4 }}
                  >
                    Save template
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── PREVIEW: mapped records table ────────────────────────── */}
          {step === 'preview' && (
            <>
              <div className="section-title" style={{ marginBottom: 8 }}>
                Import Preview — {preview.length} record{preview.length !== 1 ? 's' : ''}
                {' '}
                <span className="pill pill-green" style={{ fontSize:11 }}>
                  {preview.filter(r => r.status === 'ready').length} ready
                </span>
                {' '}
                {preview.filter(r => r.status === 'needs_review').length > 0 && (
                  <span className="pill pill-amber" style={{ fontSize:11 }}>
                    {preview.filter(r => r.status === 'needs_review').length} needs review
                  </span>
                )}
              </div>
              <div className="small" style={{ marginBottom:10 }}>
                All records will be imported. Records marked <b>Needs Review</b> will be saved with a flag in notes.
              </div>
              <table className="record-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>PO Number</th>
                    <th>Supplier</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Owner</th>
                    <th>Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map(r => (
                    <tr key={r.id}>
                      <td>
                        <span title={r.status === 'ready' ? 'Ready' : 'Needs review'}
                          style={{ fontSize:14 }}>{r.status === 'ready' ? '✅' : '⚠️'}</span>
                      </td>
                      <td><span className="rec-id">{r.data.poNumber || '—'}</span></td>
                      <td><b>{r.data.supplier || '—'}</b></td>
                      <td style={{ color: r.data.amountUsd ? 'var(--color-completed)' : 'var(--color-muted)', fontWeight:700 }}>
                        {r.data.amountUsd ? `$${r.data.amountUsd.toLocaleString()}` : '—'}
                      </td>
                      <td><span className="small">{r.data.date || '—'}</span></td>
                      <td><span className="small">{r.data.employeeName || '—'}</span></td>
                      <td>
                        {r.issues.length > 0 ? (
                          <span className="small" style={{ color:'var(--color-warning)' }}>
                            {r.issues.map(i => i.reason).join(' · ')}
                          </span>
                        ) : (
                          <span className="small" style={{ color:'var(--color-completed)' }}>OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {error && <div className="import-error" style={{ marginTop:12 }}>{error}</div>}
              <div style={{ display:'flex', gap:10, marginTop:16 }}>
                <button className="save-button" style={{ marginTop:0 }}
                  onClick={handleImport}
                  disabled={preview.length === 0}>
                  Import {preview.length} record{preview.length !== 1 ? 's' : ''}
                </button>
                {sourceType !== 'pdf' && (
                  <button onClick={() => setStep('mapping')}
                    style={{ background:'rgba(255,255,255,.07)', border:'1px solid var(--color-border)', color:'#e8eef7', borderRadius:12, padding:'11px 20px', cursor:'pointer', fontFamily:'inherit', fontSize:14 }}>
                    ← Edit mapping
                  </button>
                )}
                <button onClick={onClose}
                  style={{ background:'transparent', border:'none', color:'var(--color-muted)', cursor:'pointer', fontSize:14 }}>
                  Cancel
                </button>
              </div>
            </>
          )}

          {/* ── IMPORTING ─────────────────────────────────────────────── */}
          {step === 'importing' && (
            <div className="panel-empty">
              <div className="panel-empty-icon">📥</div>
              <div>Importing records…</div>
            </div>
          )}

          {/* ── DONE ──────────────────────────────────────────────────── */}
          {step === 'done' && importResult && (
            <div style={{ textAlign:'center', padding:'32px 0' }}>
              <div style={{ fontSize:40, marginBottom:16 }}>✅</div>
              <div style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>Import complete</div>
              <div className="small">
                {importResult.success} record{importResult.success !== 1 ? 's' : ''} imported successfully.
                {importResult.skipped > 0 && ` ${importResult.skipped} skipped (missing required supplier).`}
              </div>
              <button className="save-button" style={{ marginTop:24 }} onClick={onClose}>
                Done
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  );
}

// ─── Procurement History Panel ─────────────────────────────────────────────

function ProcurementHistoryRow({ recordId, onClose }: { recordId: string; onClose: () => void }) {
  const [entries, setEntries] = useState<ProcurementHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (DEMO_MODE) { setLoading(false); return; }
    fetchProcurementHistory(recordId)
      .then(rows => { setEntries(rows); setLoading(false); })
      .catch(() => setLoading(false));
  }, [recordId]);

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
           ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ padding: '14px 18px', background: 'rgba(91,141,238,.05)', borderTop: '1px solid rgba(255,255,255,.07)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-accent)' }}>Change History</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', fontSize: 13, cursor: 'pointer', padding: 0 }}>✕ Close</button>
      </div>
      {DEMO_MODE && <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>Change history requires production mode.</div>}
      {!DEMO_MODE && loading && <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>Loading…</div>}
      {!DEMO_MODE && !loading && entries.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>No changes recorded yet.</div>
      )}
      {!DEMO_MODE && !loading && entries.length > 0 && (
        <div style={{ paddingTop: 4 }}>
          {entries.map((e, i) => (
            <div key={e.id} style={{ display: 'flex', gap: 12, paddingBottom: i < entries.length - 1 ? 16 : 4 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--color-accent)', marginTop: 3 }} />
                {i < entries.length - 1 && <div style={{ width: 1, flex: 1, background: 'rgba(255,255,255,.1)', marginTop: 5 }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 2 }}>{fmt(e.changedAt)}{e.changedBy ? ` · ${e.changedBy}` : ''}</div>
                <div style={{ fontSize: 12 }}>
                  <b style={{ color: '#e8eef7' }}>{e.fieldName}</b>
                  {e.oldValue != null && <span style={{ color: 'var(--color-danger)' }}> {e.oldValue}</span>}
                  {e.oldValue != null && e.newValue != null && <span style={{ color: 'var(--color-muted)' }}> →</span>}
                  {e.newValue != null && <span style={{ color: 'var(--color-completed)' }}> {e.newValue}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ProcurementViewPanel ────────────────────────────────────────────────────
function ProcurementViewPanel({ record, onClose }: { record: ProcurementRecord; onClose: () => void }) {
  const [attachments, setAttachments] = useState<RecordAttachment[]>([]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    if (DEMO_MODE) return;
    fetchAttachmentsForRecord('procurement', record.id).then(setAttachments);
  }, [record.id]);

  const eta = record.notes?.match(/Expected Receipt Date:\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  const isOverdue = eta && record.status !== 'PO Arrived' && new Date(eta).getTime() < Date.now();

  const row = (label: string, val: React.ReactNode) => (
    <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
      <span style={{ width: 130, flexShrink: 0, fontSize: 12, color: 'var(--color-muted)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#e8eef7' }}>{val}</span>
    </div>
  );

  return (
    <>
      <div className="panel-overlay" style={{ zIndex: 3000 }} onClick={onClose} />
      <div className="detail-panel" style={{ zIndex: 3001, width: 'min(540px,100vw)' }} onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <div>
            <h3>{record.poNumber || 'PO Details'}</h3>
            <div className="small" style={{ marginTop: 4 }}>{record.supplier}</div>
          </div>
          <button className="panel-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="panel-body">
          {row('Status', <span className={`status-badge ${record.status === 'PO Arrived' ? 'status-complete' : 'status-open'}`}>{record.status}</span>)}
          {row('Supplier', record.supplier)}
          {row('Amount', <MoneyCell record={record} />)}
          {row('Date', record.date)}
          {row('Owner', record.employeeName || '—')}
          {row('Category', record.category)}
          {eta && row('ETA', <span style={{ color: isOverdue ? 'var(--color-danger)' : 'var(--color-completed)' }}>{eta}{isOverdue ? ' ⚠ overdue' : ''}</span>)}
          {record.notes && (
            <div style={{ padding: '10px 0' }}>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, marginBottom: 6 }}>Notes</div>
              <div style={{ fontSize: 13, color: '#e8eef7', whiteSpace: 'pre-wrap', lineHeight: 1.6, background: 'rgba(0,0,0,.2)', borderRadius: 8, padding: '10px 12px' }}>{record.notes}</div>
            </div>
          )}
          {!DEMO_MODE && (
            <div style={{ padding: '10px 0' }}>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, marginBottom: 6 }}>Attachments</div>
              {attachments.length === 0
                ? <div className="form-note">No attachments</div>
                : attachments.map(a => (
                  <div key={a.id} style={{ marginBottom: 4 }}>
                    <a href={getAttachmentPublicUrl(a.filePath)} target="_blank" rel="noreferrer"
                      style={{ color: 'var(--color-accent)', fontSize: 12, textDecoration: 'underline' }}>
                      📎 {a.fileName}{a.fileSize ? ` (${Math.round(a.fileSize / 1024)}KB)` : ''}
                    </a>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── ProcurementStatusDrillDown ──────────────────────────────────────────────
function ProcurementStatusDrillDown({
  label, status, records, onClose, onSelectRecord,
}: {
  label: string;
  status: 'all' | ProcurementStatus;
  records: ProcurementRecord[];
  onClose: () => void;
  onSelectRecord?: (r: ProcurementRecord) => void;
}) {
  const filtered = status === 'all' ? records : records.filter(r => r.status === status);
  const total    = filtered.reduce((s, r) => s + r.amountUsd, 0);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const csvName = `procurement-${label.toLowerCase().replace(/\s+/g, '-')}.csv`;

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <div className="detail-panel" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <div>
            <h3>{label}</h3>
            <div className="small" style={{ marginTop: 4 }}>
              {filtered.length} record{filtered.length !== 1 ? 's' : ''} · {fmtMoney(total)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => exportRecordsToCSV(filtered, csvName)}
              style={{ background: 'rgba(91,141,238,.12)', border: '1px solid rgba(91,141,238,.3)', color: 'var(--color-accent)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}
            >↓ CSV</button>
            <button
              onClick={() => exportRecordsToExcel(filtered, csvName.replace('.csv', '.xlsx'))}
              style={{ background: 'rgba(91,141,238,.12)', border: '1px solid rgba(91,141,238,.3)', color: 'var(--color-accent)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}
            >↓ Excel</button>
            <button className="panel-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>
        <div className="panel-body">
          {filtered.length === 0 ? (
            <div className="panel-empty"><div className="panel-empty-icon">📋</div><div>No records</div></div>
          ) : (
            <table className="record-table">
              <thead>
                <tr><th>PO #</th><th>Supplier</th><th>Amount</th><th>Owner</th><th>Date</th><th>Status</th></tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}
                    style={{ cursor: onSelectRecord ? 'pointer' : undefined }}
                    onClick={() => onSelectRecord?.(r)}
                    onMouseEnter={e => { if (onSelectRecord) e.currentTarget.style.background = 'rgba(91,141,238,.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                  >
                    <td><span className="rec-id">{r.poNumber || '—'}</span></td>
                    <td>
                      <div className="rec-name">{r.supplier}</div>
                      {r.notes && <div className="rec-notes">{r.notes.split('\n')[0].slice(0, 60)}</div>}
                    </td>
                    <td><MoneyCell record={r} /></td>
                    <td>{r.employeeName}</td>
                    <td><span className="small">{r.date}</span></td>
                    <td><span className={`status-badge ${r.status === 'PO Arrived' ? 'status-complete' : 'status-open'}`}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

// ─── ProcurementAlerts ────────────────────────────────────────────────────────
function ProcurementAlerts({ records, onSelectRecord }: { records: ProcurementRecord[]; onSelectRecord?: (r: ProcurementRecord) => void }) {
  const now   = Date.now();
  const dayMs = 86_400_000;

  const overdue   = records.filter(r => r.status === 'PO Issued' && (now - new Date(r.date).getTime()) > 90 * dayMs);
  const stale     = records.filter(r => r.status === 'PO Issued' && (now - new Date(r.date).getTime()) > 30 * dayMs && (now - new Date(r.date).getTime()) <= 90 * dayMs);
  const highValue = records.filter(r => r.status === 'PO Issued' && r.amountUsd >= 50_000);
  const etaPassed = records.filter(r => {
    if (r.status !== 'PO Issued') return false;
    const m = r.notes?.match(/Expected Receipt Date:\s*(\d{4}-\d{2}-\d{2})/);
    return m ? new Date(m[1]).getTime() < now : false;
  });

  type AlertLevel = 'danger' | 'warning' | 'info';
  const alerts: Array<{ level: AlertLevel; title: string; detail: string; recs: ProcurementRecord[] }> = [];
  if (overdue.length)   alerts.push({ level: 'danger',  title: `${overdue.length} overdue PO${overdue.length > 1 ? 's' : ''}`,        detail: 'Pending for more than 90 days — no delivery recorded',        recs: overdue   });
  if (etaPassed.length) alerts.push({ level: 'danger',  title: `${etaPassed.length} PO${etaPassed.length > 1 ? 's' : ''} past ETA`,   detail: 'Expected receipt date has passed — follow up with supplier',  recs: etaPassed });
  if (highValue.length) alerts.push({ level: 'warning', title: `${highValue.length} high-value pending`,                              detail: `PO${highValue.length > 1 ? 's' : ''} over $50K awaiting delivery`, recs: highValue });
  if (stale.length)     alerts.push({ level: 'info',    title: `${stale.length} PO${stale.length > 1 ? 's' : ''} 30–90 days pending`, detail: 'Consider requesting a supplier status update',                recs: stale     });

  if (alerts.length === 0) return null;

  const LEVEL: Record<AlertLevel, { bg: string; border: string; dot: string }> = {
    danger:  { bg: 'rgba(239,68,68,.10)',  border: 'rgba(239,68,68,.30)',  dot: 'var(--color-danger)'   },
    warning: { bg: 'rgba(245,158,11,.10)', border: 'rgba(245,158,11,.30)', dot: 'var(--color-warning)'  },
    info:    { bg: 'rgba(91,141,238,.08)', border: 'rgba(91,141,238,.20)', dot: 'var(--color-accent)'   },
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <h2 className="section-title" style={{ margin: 0 }}>Procurement Alerts</h2>
        <span style={{ background: 'rgba(239,68,68,.15)', color: 'var(--color-danger)', borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{alerts.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {alerts.map((a, i) => {
          const s = LEVEL[a.level];
          return (
            <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: 13, color: s.dot }}>{a.title}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: a.recs.length ? 6 : 0 }}>{a.detail}</div>
              {a.recs.length > 0 && (
                <div style={{ fontSize: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {a.recs.slice(0, 4).map((r, ri) => (
                    <span
                      key={ri}
                      role={onSelectRecord ? 'button' : undefined}
                      tabIndex={onSelectRecord ? 0 : undefined}
                      onClick={() => onSelectRecord?.(r)}
                      onKeyDown={e => e.key === 'Enter' && onSelectRecord?.(r)}
                      style={{
                        background: 'rgba(255,255,255,.05)', borderRadius: 6, padding: '2px 8px', color: '#e8eef7',
                        cursor: onSelectRecord ? 'pointer' : undefined,
                        textDecoration: onSelectRecord ? 'underline' : undefined,
                        textDecorationColor: 'rgba(255,255,255,.2)',
                      }}
                    >
                      {r.poNumber || r.supplier} <span style={{ color: 'var(--color-muted)' }}>({fmtMoney(r.amountUsd)})</span>
                    </span>
                  ))}
                  {a.recs.length > 4 && <span style={{ color: 'var(--color-muted)', fontSize: 11 }}>+{a.recs.length - 4} more</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SupplierDashboard ────────────────────────────────────────────────────────
function SupplierDashboard({ records, onSelectRecord }: { records: ProcurementRecord[]; onSelectRecord?: (r: ProcurementRecord) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const bySupplier = new Map<string, ProcurementRecord[]>();
  for (const r of records) {
    const key = r.supplier.trim() || 'Unknown';
    if (!bySupplier.has(key)) bySupplier.set(key, []);
    bySupplier.get(key)!.push(r);
  }

  const suppliers = Array.from(bySupplier.entries())
    .map(([name, recs]) => ({
      name,
      recs,
      totalSpend:  recs.reduce((s, r) => s + r.amountUsd, 0),
      poCount:     recs.length,
      arrived:     recs.filter(r => r.status === 'PO Arrived').length,
      issued:      recs.filter(r => r.status === 'PO Issued').length,
      deliveryPct: recs.length > 0 ? Math.round((recs.filter(r => r.status === 'PO Arrived').length / recs.length) * 100) : 0,
    }))
    .sort((a, b) => b.totalSpend - a.totalSpend);

  if (suppliers.length === 0) return null;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 className="section-title" style={{ margin: 0 }}>Supplier Dashboard</h2>
        <button
          onClick={() => exportRecordsToExcel(records, 'supplier-summary.xlsx')}
          style={{ background: 'rgba(91,141,238,.12)', border: '1px solid rgba(91,141,238,.3)', color: 'var(--color-accent)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}
        >↓ Excel</button>
      </div>
      <table className="record-table">
        <thead>
          <tr><th>Supplier</th><th>Total Spend</th><th>POs</th><th>Received</th><th>Pending</th><th>Received Rate</th></tr>
        </thead>
        <tbody>
          {suppliers.flatMap(s => [
            <tr key={s.name} style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === s.name ? null : s.name)}>
              <td><b>{s.name}</b> <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>{expanded === s.name ? '▲' : '▼'}</span></td>
              <td><b style={{ color: 'var(--color-accent)' }}>{fmtMoney(s.totalSpend)}</b></td>
              <td>{s.poCount}</td>
              <td style={{ color: 'var(--color-completed)' }}>{s.arrived}</td>
              <td style={{ color: s.issued > 0 ? 'var(--color-warning)' : 'var(--color-muted)' }}>{s.issued}</td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,.08)', borderRadius: 3, overflow: 'hidden', minWidth: 50 }}>
                    <div style={{ width: `${s.deliveryPct}%`, height: '100%', background: s.deliveryPct >= 80 ? 'var(--color-completed)' : s.deliveryPct >= 50 ? 'var(--color-warning)' : 'var(--color-danger)', borderRadius: 3 }} />
                  </div>
                  <span className="small">{s.deliveryPct}%</span>
                </div>
              </td>
            </tr>,
            expanded === s.name ? (
              <tr key={`${s.name}-detail`}>
                <td colSpan={6} style={{ padding: 0 }}>
                  <div style={{ padding: '8px 16px 12px', background: 'rgba(0,0,0,.25)', borderTop: '1px solid rgba(255,255,255,.05)' }}>
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ color: 'var(--color-muted)' }}>
                          {['PO #', 'Amount', 'Date', 'ETA', 'Status'].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '3px 8px 6px 0', fontWeight: 600 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {s.recs.map(r => {
                          const eta = r.notes?.match(/Expected Receipt Date:\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
                          const etaOverdue = eta && r.status !== 'PO Arrived' && new Date(eta).getTime() < Date.now();
                          return (
                            <tr key={r.id}
                              style={{ borderTop: '1px solid rgba(255,255,255,.04)', cursor: onSelectRecord ? 'pointer' : undefined }}
                              onClick={() => onSelectRecord?.(r)}
                              onMouseEnter={e => { if (onSelectRecord) e.currentTarget.style.background = 'rgba(91,141,238,.08)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                            >
                              <td style={{ padding: '4px 8px 4px 0', color: 'var(--color-accent)' }}>{r.poNumber || '—'}</td>
                              <td style={{ padding: '4px 8px 4px 0' }}>{fmtMoney(r.amountUsd)}</td>
                              <td style={{ padding: '4px 8px 4px 0', color: 'var(--color-muted)' }}>{r.date}</td>
                              <td style={{ padding: '4px 8px 4px 0', color: etaOverdue ? 'var(--color-danger)' : eta ? 'var(--color-completed)' : 'var(--color-muted)' }}>{eta ?? '—'}</td>
                              <td><span className={`status-badge ${r.status === 'PO Arrived' ? 'status-complete' : 'status-open'}`}>{r.status}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            ) : null,
          ])}
        </tbody>
      </table>
    </div>
  );
}

// ─── GlobalSearch ──────────────────────────────────────────────────────────────
function GlobalSearch({
  open, onClose, procRecords, supportLogs, opsRecords,
}: {
  open: boolean;
  onClose: () => void;
  procRecords: ProcurementRecord[];
  supportLogs: SupportLog[];
  opsRecords: OperationsRecord[];
}) {
  const [query,       setQuery]       = useState('');
  const [activeIdx,   setActiveIdx]   = useState(-1);
  const [viewingPO,   setViewingPO]   = useState<ProcurementRecord | null>(null);
  const [viewingLog,  setViewingLog]  = useState<SupportLog | null>(null);
  const [viewingOps,  setViewingOps]  = useState<OperationsRecord | null>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) { setQuery(''); setActiveIdx(-1); setViewingPO(null); setViewingLog(null); setViewingOps(null); setTimeout(() => inputRef.current?.focus(), 40); }
  }, [open]);

  const q = query.trim().toLowerCase();
  type Hit = { type: 'PO' | 'Activity' | 'Ops'; id: string; title: string; sub: string; record?: ProcurementRecord; log?: SupportLog; opsRec?: OperationsRecord };
  const results: Hit[] = q.length < 2 ? [] : [
    ...procRecords.filter(r =>
      r.poNumber?.toLowerCase().includes(q) ||
      r.supplier?.toLowerCase().includes(q) ||
      r.notes?.toLowerCase().includes(q)
    ).slice(0, 8).map(r => ({ type: 'PO' as const, id: r.id, title: r.poNumber ? `${r.poNumber} — ${r.supplier}` : r.supplier, sub: `${fmtMoney(r.amountUsd)} · ${r.status} · ${r.date}`, record: r })),
    ...supportLogs.filter(l =>
      l.title?.toLowerCase().includes(q) ||
      l.notes?.toLowerCase().includes(q) ||
      l.employeeName?.toLowerCase().includes(q)
    ).slice(0, 5).map(l => ({ type: 'Activity' as const, id: l.id, title: l.title, sub: `${l.employeeName} · ${l.date}`, log: l })),
    ...opsRecords.filter(r =>
      r.category?.toLowerCase().includes(q) ||
      r.notes?.toLowerCase().includes(q) ||
      r.employeeName?.toLowerCase().includes(q)
    ).slice(0, 3).map(r => ({ type: 'Ops' as const, id: r.id, title: r.category, sub: `Qty ${r.quantity} · ${r.employeeName} · ${r.date}`, opsRec: r })),
  ];

  const openHit = (hit: Hit) => {
    if (hit.type === 'PO'       && hit.record) { setViewingLog(null); setViewingOps(null); setViewingPO(hit.record);  return; }
    if (hit.type === 'Activity' && hit.log)    { setViewingPO(null);  setViewingOps(null); setViewingLog(hit.log);    return; }
    if (hit.type === 'Ops'      && hit.opsRec) { setViewingPO(null);  setViewingLog(null); setViewingOps(hit.opsRec); return; }
    onClose();
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') { if (viewingPO || viewingLog || viewingOps) { setViewingPO(null); setViewingLog(null); setViewingOps(null); } else { onClose(); } return; }
      if (results.length === 0) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); openHit(results[activeIdx]); }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, results, activeIdx, viewingPO]);

  // Scroll active item into view
  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return;
    const el = listRef.current.children[activeIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const BADGE_COLOR: Record<string, string> = {
    PO:       'rgba(91,141,238,.25)',
    Activity: 'rgba(34,197,94,.20)',
    Ops:      'rgba(245,158,11,.20)',
  };
  const TEXT_COLOR: Record<string, string> = {
    PO:       'var(--color-accent)',
    Activity: 'var(--color-completed)',
    Ops:      'var(--color-warning)',
  };

  if (!open) return null;

  return (
    <>
      <div className="panel-overlay" style={{ backdropFilter: 'blur(4px)', zIndex: 2000 }} onClick={onClose} />
      <div style={{
        position: 'fixed', top: '14%', left: '50%', transform: 'translateX(-50%)',
        width: 'min(640px, 92vw)', background: 'var(--color-card)',
        border: '1px solid rgba(255,255,255,.12)', borderRadius: 16,
        zIndex: 2001, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.65)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,.07)', gap: 10 }}>
          <span style={{ fontSize: 15, color: 'var(--color-muted)' }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(-1); }}
            placeholder="Search POs, suppliers, activities…"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 15, color: '#e8eef7', fontFamily: 'inherit' }}
          />
          <kbd style={{ fontSize: 11, color: 'var(--color-muted)', background: 'rgba(255,255,255,.06)', borderRadius: 5, padding: '2px 7px', fontFamily: 'inherit' }}>Esc</kbd>
        </div>
        <div ref={listRef} style={{ maxHeight: 440, overflowY: 'auto' }}>
          {q.length < 2 ? (
            <div style={{ padding: '22px 18px', color: 'var(--color-muted)', fontSize: 13 }}>Type 2+ characters to search across POs, suppliers, activities and operations.</div>
          ) : results.length === 0 ? (
            <div style={{ padding: '22px 18px', color: 'var(--color-muted)', fontSize: 13 }}>No results for &quot;{query}&quot;</div>
          ) : results.map((r, i) => (
            <div
              key={r.id + i}
              style={{
                padding: '11px 18px', cursor: 'pointer',
                borderBottom: '1px solid rgba(255,255,255,.04)',
                display: 'flex', alignItems: 'center', gap: 12,
                background: i === activeIdx ? 'rgba(91,141,238,.13)' : 'transparent',
              }}
              onClick={() => openHit(r)}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseLeave={() => setActiveIdx(-1)}
            >
              <span style={{ fontSize: 10, fontWeight: 700, background: BADGE_COLOR[r.type], color: TEXT_COLOR[r.type], borderRadius: 5, padding: '2px 7px', minWidth: 52, textAlign: 'center', flexShrink: 0 }}>
                {r.type}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e8eef7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{r.sub}</div>
              </div>
              {r.type === 'PO' && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-muted)', flexShrink: 0 }}>View →</span>}
            </div>
          ))}
        </div>
      </div>
      {viewingPO  && <ProcurementViewPanel record={viewingPO} onClose={() => setViewingPO(null)} />}
      {viewingLog && (
        <>
          <div className="panel-overlay" style={{ zIndex: 3000 }} onClick={() => setViewingLog(null)} />
          <div className="detail-panel" style={{ zIndex: 3001, width: 'min(480px,100vw)' }} onClick={e => e.stopPropagation()}>
            <div className="panel-header">
              <div><h3>{viewingLog.title}</h3><div className="small" style={{ marginTop: 4 }}>{viewingLog.employeeName} · {viewingLog.date}</div></div>
              <button className="panel-close" onClick={() => setViewingLog(null)}>✕</button>
            </div>
            <div className="panel-body">
              {[
                ['Category', viewingLog.category],
                ['Department', viewingLog.department],
                ['Hours', `${fmtHours(viewingLog.hours)}h`],
              ].map(([l, v]) => v ? (
                <div key={l} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  <span style={{ width: 110, flexShrink: 0, fontSize: 12, color: 'var(--color-muted)', fontWeight: 600 }}>{l}</span>
                  <span style={{ fontSize: 13, color: '#e8eef7' }}>{v}</span>
                </div>
              ) : null)}
              {viewingLog.notes && (
                <div style={{ padding: '10px 0' }}>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, marginBottom: 6 }}>Notes</div>
                  <div style={{ fontSize: 13, color: '#e8eef7', whiteSpace: 'pre-wrap', lineHeight: 1.6, background: 'rgba(0,0,0,.2)', borderRadius: 8, padding: '10px 12px' }}>{viewingLog.notes}</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
      {viewingOps && (
        <>
          <div className="panel-overlay" style={{ zIndex: 3000 }} onClick={() => setViewingOps(null)} />
          <div className="detail-panel" style={{ zIndex: 3001, width: 'min(480px,100vw)' }} onClick={e => e.stopPropagation()}>
            <div className="panel-header">
              <div><h3>{viewingOps.category}</h3><div className="small" style={{ marginTop: 4 }}>{viewingOps.employeeName} · {viewingOps.date}</div></div>
              <button className="panel-close" onClick={() => setViewingOps(null)}>✕</button>
            </div>
            <div className="panel-body">
              {[
                ['Quantity', String(viewingOps.quantity)],
                ['Status', viewingOps.status],
              ].map(([l, v]) => v ? (
                <div key={l} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  <span style={{ width: 110, flexShrink: 0, fontSize: 12, color: 'var(--color-muted)', fontWeight: 600 }}>{l}</span>
                  <span style={{ fontSize: 13, color: '#e8eef7' }}>{v}</span>
                </div>
              ) : null)}
              {viewingOps.notes && (
                <div style={{ padding: '10px 0' }}>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, marginBottom: 6 }}>Notes</div>
                  <div style={{ fontSize: 13, color: '#e8eef7', whiteSpace: 'pre-wrap', lineHeight: 1.6, background: 'rgba(0,0,0,.2)', borderRadius: 8, padding: '10px 12px' }}>{viewingOps.notes}</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ─── Procurement Page ──────────────────────────────────────────────────────

function ProcurementPage({ timeFilter, activeTeamMembers, authUserEmail, authUserId, onRecordAdded, onRecordDeleted }: {
  timeFilter: TimeFilter;
  activeTeamMembers: TeamMember[];
  authUserEmail?: string;
  authUserId?: string;
  onRecordAdded?: (record: ProcurementRecord) => void;
  onRecordDeleted?: (id: string) => void;
}) {
  const [records,      setRecords]      = useState<ProcurementRecord[]>(DEMO_MODE ? mockProcurementRecords : []);
  const [loading,      setLoading]      = useState(!DEMO_MODE);
  const [selected,      setSelected]      = useState<ProcurementCategory | null>(null);
  const [statusFilter,  setStatusFilter]  = useState<'all' | ProcurementStatus | null>(null);
  const [viewingRecord, setViewingRecord] = useState<ProcurementRecord | null>(null);
  const [showForm,      setShowForm]      = useState(false);
  const [showImport,    setShowImport]    = useState(false);
  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [historyId,     setHistoryId]     = useState<string | null>(null);
  const [saveErr,       setSaveErr]       = useState('');
  const [deletingRecord, setDeletingRecord] = useState<ProcurementRecord | null>(null);

  useEffect(() => {
    if (DEMO_MODE) return;
    setLoading(true);
    fetchProcurementFromDB(timeFilter).then(data => { setRecords(data); setLoading(false); });
  }, [timeFilter]);

  // Derived KPIs — status-based financial totals
  const arrivedRecords = records.filter(r => r.status === 'PO Arrived');
  const issuedRecords  = records.filter(r => r.status === 'PO Issued');
  const totalAmt   = records.reduce((s, r) => s + r.amountUsd, 0);
  const arrivedAmt = arrivedRecords.reduce((s, r) => s + r.amountUsd, 0);
  const issuedAmt  = issuedRecords.reduce((s, r) => s + r.amountUsd, 0);

  const handleSave = async (record: ProcurementRecord) => {
    setSaveErr('');
    try {
      const withOwner = { ...record, createdBy: authUserEmail };
      if (!DEMO_MODE) await insertProcurementToDB(withOwner, authUserEmail);
      setRecords(prev => [withOwner, ...prev]);
      onRecordAdded?.(withOwner);
      setShowForm(false);
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Failed to save record.');
    }
  };

  const handleDelete = async (record: ProcurementRecord, reason: string) => {
    try {
      if (!DEMO_MODE) await softDeleteProcurementRecord(record.id, reason);
      setRecords(prev => prev.filter(r => r.id !== record.id));
      onRecordDeleted?.(record.id);
      setDeletingRecord(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete record.');
    }
  };

  // Check if current user can delete a record
  const canDelete = (record: ProcurementRecord): boolean =>
    Boolean(authUserEmail) && (
      record.createdBy  === authUserEmail ||
      record.employeeId === authUserEmail ||
      isAdmin(authUserEmail)
    );

  const handleEdit = async (id: string, patch: Partial<ProcurementRecord>) => {
    try {
      const oldRecord = records.find(r => r.id === id);
      if (!DEMO_MODE) await updateProcurementInDB(id, patch, oldRecord, authUserEmail ?? undefined);
      setRecords(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
      setEditingId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update record.');
    }
  };

  // Bulk import: inserts each mapped record + creates a support_log for Activity Feed
  const handleBulkImport = async (mapped: MappedRecord<ProcurementRecord>[]) => {
    // Helper: extract a short item/description name from a raw import row.
    function extractImportItemName(rawData: Record<string, string | number | null>): string {
      const candidates = [
        'DESCRIPTION', 'description', 'ITEM_DESCRIPTION', 'Item Description',
        'ITEM', 'item', 'ITEM_NUM', 'ITEM_NUMBER', 'Item Number',
        'LINE_ITEMS', 'Items', 'Notes', 'Comments',
      ];
      for (const key of candidates) {
        const val = rawData[key];
        if (val && String(val).trim()) return String(val).trim().slice(0, 80);
      }
      return '';
    }
    const defaultEmployee = activeTeamMembers.find(m => m.id === authUserEmail);

    // Group by PO number so multi-row POs are merged into one record.
    // Rows without a PO number are never merged (each gets a unique key).
    type ImportGroup = { members: MappedRecord<ProcurementRecord>[]; indices: number[] };
    const groupMap = new Map<string, ImportGroup>();
    mapped.forEach((m, i) => {
      const poKey = m.data.poNumber?.trim() ? m.data.poNumber.trim().toUpperCase() : `__NO_PO_${i}__`;
      if (!groupMap.has(poKey)) groupMap.set(poKey, { members: [], indices: [] });
      groupMap.get(poKey)!.members.push(m);
      groupMap.get(poKey)!.indices.push(i);
    });

    // Flatten groups into a merged list; multi-row groups become one record.
    const mergedMapped: Array<{ m: MappedRecord<ProcurementRecord>; i: number; mergeSummary: string | null }> = [];
    for (const { members, indices } of groupMap.values()) {
      if (members.length === 1) {
        mergedMapped.push({ m: members[0], i: indices[0], mergeSummary: null });
      } else {
        // Merge: use first member as base, sum amounts, collect item names.
        const base = members[0];
        const totalAmount = members.reduce((s, mr) => s + (mr.data.amountUsd ?? 0), 0);
        const rowNums = indices.map(idx => idx + 2); // row 1 = header
        const itemNames = members.map(mr => extractImportItemName(mr.rawData)).filter(Boolean);
        const mergeSummary = [
          `Import Merge Summary:`,
          `  • ${members.length} Excel rows merged`,
          `  • Rows: ${rowNums.join(', ')}`,
          itemNames.length > 0 ? `  • Items: ${itemNames.join(', ')}` : null,
          `  • Combined amount: $${totalAmount.toLocaleString()}`,
          ``,
          `---`,
          ``,
          ...members.map((mr, gi) => {
            const rn = indices[gi] + 2;
            const item = extractImportItemName(mr.rawData);
            const amt  = mr.data.amountUsd ?? 0;
            const note = mr.data.notes ?? '';
            return [
              `Row ${rn}${item ? ` — ${item}` : ''}${amt > 0 ? ` — $${amt.toLocaleString()}` : ''}`,
              note ? `  ${note}` : '',
            ].filter(Boolean).join('\n');
          }),
        ].filter(s => s !== null).join('\n');

        // Patch the base member with merged amount + notes placeholder
        const merged: MappedRecord<ProcurementRecord> = {
          ...base,
          data: { ...base.data, amountUsd: totalAmount },
          // mark as needs_review if any member needs review
          status: members.some(mr => mr.status === 'needs_review') ? 'needs_review' : base.status,
        };
        mergedMapped.push({ m: merged, i: indices[0], mergeSummary });
      }
    }

    for (const { m, i, mergeSummary } of mergedMapped) {
      const finalEmployeeId   = m.data.employeeId   ?? authUserEmail ?? '';
      const finalEmployeeName = m.data.employeeName ?? defaultEmployee?.name ?? 'Operations Team';
      const needsReview       = m.status === 'needs_review';
const rawRow = ((m.rawImport as any)?.extractedRows?.[i] ?? {}) as Record<string, any>;

const rawPoDate =
  rawRow.PO_DATE ??
  rawRow.po_date ??
  rawRow.date ??
  rawRow.DATE ??
  m.data.date;

const normalizedDate =
  typeof rawPoDate === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawPoDate)
    ? (() => {
        const [dd, mm, yyyy] = rawPoDate.split('/');
        return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
      })()
    : m.data.date ?? new Date().toISOString().slice(0, 10);
    const rawAmount = m.data.originalAmount ?? m.data.amountUsd ?? 0;

    // m.rawData is the normalized raw Excel row — keys match the actual column
    // headers after Unicode whitespace stripping. 'Currency' (capital C) is the
    // exact NetSuite column name. rawRow.CURRENCY / rawRow.currency both miss it.
    const rawCurrency = String(
      m.rawData['Currency'] ??       // NetSuite exact name (post-normalization)
      m.rawData['CURRENCY'] ??       // Oracle/generic ERP uppercase
      m.rawData['currency'] ??       // lowercase variant
      m.data.originalCurrency ??     // set by column map if wired correctly
      'USD'
    ).toUpperCase().trim();

    let convertedAmountUsd = rawAmount;
    let convertedRate: number | undefined     = rawCurrency === 'USD' ? 1        : undefined;
    let convertedRateDate: string | undefined = rawCurrency === 'USD' ? new Date().toISOString().slice(0, 10) : undefined;

    if (rawAmount > 0 && rawCurrency !== 'USD') {
      const conv = await convertToUsd(rawAmount, rawCurrency);
      convertedAmountUsd = conv.usdAmount;
      convertedRate      = conv.exchangeRate;
      convertedRateDate  = conv.exchangeRateDate;
      console.log(
        `[import] currency conversion: ${rawAmount} ${rawCurrency}` +
        ` → $${convertedAmountUsd} USD (rate ${convertedRate}, fallback=${conv.isFallback})`
      );
    }
      const record: ProcurementRecord = {
        id:               m.id,
        employeeId:       finalEmployeeId,
        employeeName:     finalEmployeeName,
        poNumber:         m.data.poNumber  ?? '',
        supplier:         m.data.supplier  ?? '',
        amountUsd:        convertedAmountUsd,
        originalAmount:   rawAmount,          // always the pre-conversion value in rawCurrency
        originalCurrency: rawCurrency,
        exchangeRate:     convertedRate,
        exchangeRateDate: convertedRateDate,
        category:         m.data.category ?? 'PO Created',
        status:           normalizeProcurementStatus(m.data.status),
        notes: [
          needsReview ? '[NEEDS REVIEW]' : '',
          mergeSummary ?? '',
          m.data.notes ?? '',
        ].filter(Boolean).join('\n\n'),
        date:             normalizedDate,
        createdBy:        authUserEmail ?? undefined,
      };

      if (!DEMO_MODE) {
        const supabase = createClient();
        const activityDate = record.date && /^\d{4}-\d{2}-\d{2}$/.test(record.date)
          ? record.date
          : new Date().toISOString().slice(0, 10);
        const rawImport = { ...m.rawImport, extractedRows: undefined };

        // ── UPSERT: look for an existing non-deleted record with this PO number ──
        let existingRecord: ProcurementRecord | null = null;
        if (record.poNumber.trim()) {
          const { data: existingRow } = await supabase
            .from('procurement_records')
            .select('*')
            .eq('po_number', record.poNumber.trim())
            .is('deleted_at', null)
            .maybeSingle();
          if (existingRow) existingRecord = rowToProcurementRecord(existingRow);
        }

        if (existingRecord) {
          // ── UPDATE path: preserve existing ID, write history ──────────────────
          const patch: Partial<ProcurementRecord> = {
            status:           record.status,
            amountUsd:        record.amountUsd,
            notes:            record.notes,
            date:             activityDate,
            category:         record.category,
            supplier:         record.supplier,
            originalAmount:   record.originalAmount   ?? record.amountUsd,
            originalCurrency: record.originalCurrency ?? 'USD',
            exchangeRate:     record.exchangeRate,
            exchangeRateDate: record.exchangeRateDate,
          };

          const { error: updErr } = await supabase
            .from('procurement_records')
            .update({
              status:             normalizeProcurementStatus(patch.status),
              amount_usd:         patch.amountUsd ?? null,
              notes:              patch.notes,
              activity_date:      activityDate,
              category:           patch.category,
              supplier:           patch.supplier,
              original_amount:    patch.originalAmount   ?? patch.amountUsd ?? null,
              original_currency:  patch.originalCurrency ?? 'USD',
              exchange_rate:      patch.exchangeRate      ?? null,
              exchange_rate_date: patch.exchangeRateDate && /^\d{4}-\d{2}-\d{2}$/.test(patch.exchangeRateDate)
                ? patch.exchangeRateDate
                : new Date().toISOString().slice(0, 10),
              raw_import:         rawImport,
            })
            .eq('id', existingRecord.id);

          if (updErr) {
            console.error(`import upsert update [${record.poNumber}]:`, updErr.message);
            continue;
          }

          // Write change history for anything that actually changed
          await insertProcurementHistoryRows(
            existingRecord.id, existingRecord, patch, authUserEmail ?? 'import'
          );

          // Reflect in local state using the EXISTING id
          const updated = { ...existingRecord, ...patch, id: existingRecord.id };
          setRecords(prev => {
            const exists = prev.some(r => r.id === existingRecord!.id);
            return exists
              ? prev.map(r => r.id === existingRecord!.id ? updated : r)
              : [...prev, updated];
          });

          // Activity log: note it was an update, not a create
          if (authUserId) {
            const summaryTitle = `PO updated via import: ${record.poNumber} — ${record.supplier} — $${(record.amountUsd || 0).toLocaleString()}`;
            const logEntry: SupportLog = {
              id:           `LOG-import-upd-${existingRecord.id}-${Date.now()}`,
              employeeId:   finalEmployeeId,
              employeeName: finalEmployeeName,
              department:   'Operations',
              category:     'Procurement',
              title:        summaryTitle,
              hours:        0.1,
              date:         activityDate,
              week:         getWeekTag(activityDate),
              notes:        `Updated via import · Supplier: ${record.supplier} · Total: $${(record.amountUsd || 0).toLocaleString()} · Status: ${record.status}`,
            };
            await insertLogToDB(logEntry, authUserId, authUserEmail ?? '').catch(e => console.error('import log:', e.message));
          }
        } else {
          // ── INSERT path: new record ────────────────────────────────────────────
          const { data: inserted, error } = await supabase
            .from('procurement_records')
            .insert({
              id:                record.id,
              employee_id:       record.employeeId,
              employee_name:     record.employeeName,
              po_number:         record.poNumber || null,
              supplier:          record.supplier,
              amount_usd:        record.amountUsd || null,
              category:          record.category,
              status:            normalizeProcurementStatus(record.status),
              notes:             record.notes,
              activity_date:     activityDate,
              raw_import:        rawImport,
              original_amount:   record.originalAmount   ?? record.amountUsd ?? null,
              original_currency: record.originalCurrency ?? 'USD',
              exchange_rate:     record.exchangeRate      ?? (record.originalCurrency === 'USD' || !record.originalCurrency ? 1 : null),
              exchange_rate_date: record.exchangeRateDate && /^\d{4}-\d{2}-\d{2}$/.test(record.exchangeRateDate)
                ? record.exchangeRateDate
                : new Date().toISOString().slice(0, 10),
              created_by:        record.createdBy ?? null,
            })
            .select('id');

          if (error) {
            console.error(`import insert [${i}] ${record.poNumber || record.supplier}:`, error.message, error.details);
            continue;
          }
          if (!inserted || inserted.length === 0) {
            console.error(`import insert [${i}]: row was silently rejected (RLS?)`);
            continue;
          }
          onRecordAdded?.(record);

          // Activity log
          if (authUserId) {
            const summaryTitle = `PO imported: ${record.poNumber || 'N/A'} — ${record.supplier} — $${(record.amountUsd || 0).toLocaleString()}`;
            const logEntry: SupportLog = {
              id:           `LOG-import-${record.id}`,
              employeeId:   finalEmployeeId,
              employeeName: finalEmployeeName,
              department:   'Operations',
              category:     'Procurement',
              title:        summaryTitle,
              hours:        0.1,
              date:         activityDate,
              week:         getWeekTag(activityDate),
              notes:        `Supplier: ${record.supplier} · Total: $${(record.amountUsd || 0).toLocaleString()} · Status: ${record.status}`,
            };
            await insertLogToDB(logEntry, authUserId, authUserEmail ?? '').catch(e => console.error('import log:', e.message));
          }

          setRecords(prev => [...prev, record]);
        }
      } else {
        // DEMO_MODE: just add to local state
        setRecords(prev => [...prev, record]);
      }
    }

    // Refresh records from DB so the table reflects any date-based filtering correctly.
    // Don't close the import panel here — let ProcurementImportPanel show its "done" step.
    if (!DEMO_MODE) {
      fetchProcurementFromDB(timeFilter)
        .then(fresh => setRecords(fresh))
        .catch(e => console.error('post-import refresh:', e.message));
    }
  };

  return (
    <>
      {selected && <ProcurementDrillDown category={selected} records={records} onClose={() => setSelected(null)} />}
      {statusFilter !== null && (
        <ProcurementStatusDrillDown
          label={statusFilter === 'all' ? 'Total Procurement' : statusFilter === 'PO Arrived' ? 'Goods Received' : 'Goods Pending'}
          status={statusFilter}
          records={records}
          onClose={() => setStatusFilter(null)}
          onSelectRecord={r => { setViewingRecord(r); }}
        />
      )}
      {viewingRecord && <ProcurementViewPanel record={viewingRecord} onClose={() => setViewingRecord(null)} />}
      {deletingRecord && (
        <DeleteConfirmModal
          title={`${deletingRecord.poNumber || 'PO'} — ${deletingRecord.supplier} — $${deletingRecord.amountUsd.toLocaleString()}`}
          onConfirm={reason => handleDelete(deletingRecord, reason)}
          onCancel={() => setDeletingRecord(null)}
        />
      )}
      {showImport && (
        <ProcurementImportPanel
          onImport={handleBulkImport}
          onClose={() => setShowImport(false)}
          activeTeamMembers={activeTeamMembers}
          authUserEmail={authUserEmail}
        />
      )}

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h2>Procurement Activity</h2>
            <div className="small">Purchase orders, payments and emergency requests · {getTimeFilterLabel(timeFilter)}</div>
          </div>
          {!showForm && (
            <div style={{ display:'flex', gap:8, flexShrink:0, flexWrap:'wrap', justifyContent:'flex-end' }}>
              <button
                onClick={() => exportRecordsToExcel(records, 'procurement.xlsx')}
                style={{ background:'rgba(91,141,238,.12)', border:'1px solid rgba(91,141,238,.3)', color:'var(--color-accent)', borderRadius:12, padding:'11px 18px', cursor:'pointer', fontSize:14, fontWeight:700, fontFamily:'inherit', whiteSpace:'nowrap' }}
              >↓ Export</button>
              <button className="save-button" style={{ marginTop:0 }} onClick={() => setShowForm(true)}>
                + Log Procurement
              </button>
              <button
                onClick={() => setShowImport(true)}
                style={{ background:'rgba(91,141,238,.12)', border:'1px solid rgba(91,141,238,.3)', color:'var(--color-accent)', borderRadius:12, padding:'11px 18px', cursor:'pointer', fontSize:14, fontWeight:700, fontFamily:'inherit', whiteSpace:'nowrap' }}
              >↑ Import file</button>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <ProcurementEntryForm
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setSaveErr(''); }}
          activeTeamMembers={activeTeamMembers}
        />
      )}

      {saveErr && (
        <div style={{ fontSize: 13, color: 'var(--color-critical)', padding: '10px 14px', background: 'rgba(239,68,68,.08)', borderRadius: 10, marginBottom: 14 }}>
          {saveErr}
        </div>
      )}

      {loading ? (
        <div className="card"><div className="panel-empty"><div className="panel-empty-icon">⏳</div><div>Loading procurement records…</div></div></div>
      ) : (
        <>
          <div className="grid three">
            <div className="card kpi-clickable" role="button" tabIndex={0}
              onClick={() => setStatusFilter('all')}
              onKeyDown={e => e.key === 'Enter' && setStatusFilter('all')}>
              <div className="kpi-label">Total Procurement</div>
              <div className="kpi-value">{fmtMoney(totalAmt)}</div>
              <div className="small">{records.length} records</div>
            </div>
            <div className="card kpi-clickable" role="button" tabIndex={0}
              onClick={() => setStatusFilter('PO Arrived')}
              onKeyDown={e => e.key === 'Enter' && setStatusFilter('PO Arrived')}>
              <div className="kpi-label">Goods Received</div>
              <div className="kpi-value" style={{ color: 'var(--color-completed)' }}>{fmtMoney(arrivedAmt)}</div>
              <div className="small">{arrivedRecords.length} POs arrived</div>
            </div>
            <div className="card kpi-clickable" role="button" tabIndex={0}
              onClick={() => setStatusFilter('PO Issued')}
              onKeyDown={e => e.key === 'Enter' && setStatusFilter('PO Issued')}>
              <div className="kpi-label">Goods Pending</div>
              <div className="kpi-value" style={{ color: 'var(--color-warning)' }}>{fmtMoney(issuedAmt)}</div>
              <div className="small">{issuedRecords.length} POs issued</div>
            </div>
          </div>
          <ProcurementAlerts records={records} onSelectRecord={setViewingRecord} />
          <SupplierDashboard records={records} onSelectRecord={setViewingRecord} />
        </>
      )}

      {!loading && records.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 className="section-title">All Records</h2>
          <table className="table">
            <thead>
              <tr><th>Category</th><th>PO Number</th><th>Supplier</th><th>Amount</th><th>Owner</th><th>Date</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {records.flatMap(r => {
                const isEditing = editingId === r.id;
                const isHistory = historyId === r.id;
                const rows = [
                  <tr key={r.id}>
                    <td><span className="pill" style={{ fontSize: 11 }}>{r.category}</span></td>
                    <td><span className="rec-id">{r.poNumber || '—'}</span></td>
                    <td><b>{r.supplier}</b>{r.notes && <div className="small" style={{ whiteSpace: 'pre-line', maxWidth: 320 }}>{r.notes}</div>}</td>
                    <td><MoneyCell record={r} /></td>
                    <td>{r.employeeName}</td>
                    <td>{r.date}</td>
                    <td><span className={`status-badge ${r.status === 'PO Arrived' ? 'status-complete' : 'status-open'}`}>{r.status}</span></td>
                    <td style={{ display: 'flex', gap: 8, alignItems: 'center', whiteSpace: 'nowrap' }}>
                      {authUserEmail && r.employeeId === authUserEmail && !isEditing && (
                        <button
                          onClick={() => { setEditingId(r.id); setHistoryId(null); }}
                          style={{ background: 'none', border: 'none', color: 'var(--color-accent)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}
                        >Edit</button>
                      )}
                      {canDelete(r) && !isEditing && (
                        <button
                          onClick={() => setDeletingRecord(r)}
                          style={{ background: 'none', border: 'none', color: 'var(--color-critical)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}
                        >Delete</button>
                      )}
                      <button
                        onClick={() => { setHistoryId(isHistory ? null : r.id); setEditingId(null); }}
                        style={{ background: 'none', border: 'none', color: isHistory ? 'var(--color-accent)' : 'var(--color-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}
                      >History</button>
                    </td>
                  </tr>,
                ];
                if (isEditing) {
                  rows.push(
                    <tr key={`edit-${r.id}`}>
                      <td colSpan={8} style={{ padding: 0 }}>
                        <div style={{ padding: '0 10px 10px' }}>
                          <ProcurementEntryForm
                            key={`edit-form-${r.id}`}
                            initialRecord={r}
                            onSave={rec => handleEdit(r.id, rec)}
                            onCancel={() => setEditingId(null)}
                            activeTeamMembers={activeTeamMembers}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                }
                if (isHistory) {
                  rows.push(
                    <tr key={`history-${r.id}`}>
                      <td colSpan={8} style={{ padding: 0 }}>
                        <ProcurementHistoryRow recordId={r.id} onClose={() => setHistoryId(null)} />
                      </td>
                    </tr>
                  );
                }
                return rows;
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && records.length === 0 && (
        <div className="card" style={{ marginTop: 8 }}>
          <div className="panel-empty">
            <div className="panel-empty-icon">📋</div>
            <div>No procurement records for this period. Use <b>+ Log Procurement</b> to add one.</div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Edit Panels (own records) ────────────────────────────────────────────

function SupportLogEditPanel({ log, onSave, onCancel }: {
  log: SupportLog;
  onSave: (patch: Partial<SupportLog>) => void;
  onCancel: () => void;
}) {
  const [departments, setDepartments] = useState<string[]>(parseDepts(log.department));
  const [category,    setCategory]    = useState(log.category);
  const [title,       setTitle]       = useState(log.title);
  const [hours,       setHours]       = useState(String(log.hours));
  const [date,        setDate]        = useState(log.date);
  const [notes,       setNotes]       = useState(log.notes);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const save = async () => {
    if (!title.trim() || !hours || parseFloat(hours) <= 0) {
      alert('Title and a positive number of hours are required.');
      return;
    }
    if (pendingFile && !DEMO_MODE) {
      try {
        await uploadAttachmentFile(pendingFile, 'support_log', log.id);
      } catch (err) {
        console.error('Attachment upload failed:', err);
      }
    }
    onSave({ department: departments.join(', '), category, title, hours: parseFloat(hours), date, week: getWeekTag(date), notes });
  };

  const toggleDept = (d: string) =>
    setDepartments(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  return (
    <div className="card" style={{ border: '1px solid var(--color-accent)', marginBottom: 8 }}>
      <h2 className="section-title" style={{ fontSize: 14 }}>Edit Activity</h2>
      <div className="grid two">
        <div style={{ gridColumn: '1 / -1' }}>
          <div className="kpi-label">Departments Supported *</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: 6 }}>
            {SUPPORT_DEPARTMENTS.map(d => (
              <label key={d} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, cursor: 'pointer', color: departments.includes(d) ? 'var(--color-accent)' : 'var(--color-muted)' }}>
                <input type="checkbox" checked={departments.includes(d)} onChange={() => toggleDept(d)} style={{ accentColor: 'var(--color-accent)' }} />
                {d}
              </label>
            ))}
          </div>
        </div>
        <div>
          <div className="kpi-label">Category</div>
          <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
            {ACTIVITY_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <div className="kpi-label">Title</div>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div>
          <div className="kpi-label">Hours</div>
          <input className="input" type="number" min="0.5" step="0.5" value={hours} onChange={e => setHours(e.target.value)} />
        </div>
        <div>
          <div className="kpi-label">Date</div>
          <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <div className="kpi-label">Notes</div>
          <input className="input" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <AttachmentWidget
            recordType="support_log"
            recordId={log.id}
            pendingFile={pendingFile}
            onPendingFileChange={setPendingFile}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button className="save-button" style={{ marginTop: 0 }} onClick={save}>Save Changes</button>
        <button onClick={onCancel} style={{ background: 'rgba(255,255,255,.07)', border: '1px solid var(--color-border)', color: '#e8eef7', borderRadius: 12, padding: '11px 20px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Operations Drill-Down Panel ──────────────────────────────────────────

function OperationsDrillDown({ category, records, onClose }: {
  category: OperationsCategory;
  records: OperationsRecord[];
  onClose: () => void;
}) {
  const filtered = records.filter(r => r.category === category);
  const totalQty = filtered.reduce((s, r) => s + r.quantity, 0);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <div className="detail-panel" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <div>
            <h3>{category}</h3>
            <div className="small" style={{ marginTop: 4 }}>
              {filtered.length} record{filtered.length !== 1 ? 's' : ''}{totalQty > 0 ? ` · ${totalQty} total units` : ''}
            </div>
          </div>
          <button className="panel-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="panel-body">
          {filtered.length === 0 ? (
            <div className="panel-empty"><div className="panel-empty-icon">📋</div><div>No records for this period</div></div>
          ) : (
            <table className="record-table">
              <thead>
                <tr><th>Date</th><th>Employee</th><th>Quantity</th><th>Status</th><th>Notes</th></tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td><span className="small">{r.date}</span></td>
                    <td>{r.employeeName}</td>
                    <td style={{ fontWeight: 700, color: 'var(--color-completed)', whiteSpace: 'nowrap' }}>{r.quantity}</td>
                    <td><span className={`status-badge ${r.status === 'Completed' ? 'status-completed' : 'status-in-progress'}`}>{r.status}</span></td>
                    <td><span className="rec-notes">{r.notes || '—'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Operations Entry Form ─────────────────────────────────────────────────

function OperationsEntryForm({ onSave, onCancel, activeTeamMembers, initialRecord }: {
  onSave: (r: OperationsRecord) => void;
  onCancel: () => void;
  activeTeamMembers: TeamMember[];
  initialRecord?: OperationsRecord;
}) {
  const [employeeId,  setEmployeeId]  = useState(initialRecord?.employeeId ?? '');
  const [category,    setCategory]    = useState<OperationsCategory>(initialRecord?.category ?? OPERATIONS_CATEGORIES[0]);
  const [quantity,    setQuantity]    = useState(initialRecord?.quantity?.toString() ?? '');
  const [status,      setStatus]      = useState<OperationsStatus>(initialRecord?.status ?? 'Completed');
  const [notes,       setNotes]       = useState(initialRecord?.notes ?? '');
  const [date,        setDate]        = useState(initialRecord?.date ?? new Date().toISOString().slice(0, 10));
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const save = async () => {
    if (!employeeId) { alert('Please select an employee.'); return; }
    const qty = Number(quantity);
    if (!quantity.trim() || isNaN(qty) || qty <= 0) { alert('Quantity must be a positive number.'); return; }
    const member = activeTeamMembers.find(m => m.id === employeeId);
    if (!member) return;
    const recordId = initialRecord?.id ?? `OPS-${Date.now()}`;
    if (pendingFile && !DEMO_MODE) {
      try {
        await uploadAttachmentFile(pendingFile, 'operations', recordId);
      } catch (err) {
        console.error('Attachment upload failed:', err);
      }
    }
    onSave({
      id:           recordId,
      employeeId,
      employeeName: member.name,
      date,
      category,
      quantity:     qty,
      notes:        notes.trim(),
      status,
    });
  };

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <h2 className="section-title">{initialRecord ? 'Edit Operations Record' : 'Log Operations Activity'}</h2>
      <div className="grid two">
        <div>
          <div className="kpi-label">Employee *</div>
          <select className="input" value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
            <option value="">— Select employee —</option>
            {activeTeamMembers.map(m => <option key={m.id} value={m.id}>{m.name} · {m.role}</option>)}
          </select>
        </div>
        <div>
          <div className="kpi-label">Category *</div>
          <select className="input" value={category} onChange={e => setCategory(e.target.value as OperationsCategory)}>
            {OPERATIONS_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <div className="kpi-label">Quantity *</div>
          <input className="input" type="number" min="1" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="e.g. 5" />
        </div>
        <div>
          <div className="kpi-label">Status</div>
          <select className="input" value={status} onChange={e => setStatus(e.target.value as OperationsStatus)}>
            {OPERATIONS_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <div className="kpi-label">Activity Date</div>
          <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <div className="kpi-label">Notes</div>
          <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional context or outcome" />
        </div>
        <div>
          <AttachmentWidget
            recordType="operations"
            recordId={initialRecord?.id}
            pendingFile={pendingFile}
            onPendingFileChange={setPendingFile}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button className="save-button" style={{ marginTop: 0 }} onClick={save}>
          {initialRecord ? 'Save Changes' : 'Save'}
        </button>
        <button onClick={onCancel} style={{ background: 'rgba(255,255,255,.07)', border: '1px solid var(--color-border)', color: '#e8eef7', borderRadius: 12, padding: '11px 20px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Operations Page (live data) ───────────────────────────────────────────

function OperationsPage({ timeFilter, activeTeamMembers, authUserEmail, onRecordAdded }: {
  timeFilter: TimeFilter;
  activeTeamMembers: TeamMember[];
  authUserEmail?: string;
  onRecordAdded?: (record: OperationsRecord) => void;
}) {
  const [records,   setRecords]   = useState<OperationsRecord[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState<OperationsCategory | null>(null);
  const [showForm,  setShowForm]  = useState(false);
  const [saveErr,   setSaveErr]   = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
const [deletingRecord, setDeletingRecord] = useState<OperationsRecord | null>(null);
  useEffect(() => {
    const { start, end } = getDateRangeForFilter(timeFilter);
    end.setHours(23, 59, 59, 999);
    if (DEMO_MODE) {
      setRecords(mockOperationsRecords.filter(r => {
        const d = new Date(r.date + 'T00:00:00');
        return d >= start && d <= end;
      }));
      setLoading(false);
    } else {
      setLoading(true);
      fetchOperationsFromDB(timeFilter).then(data => { setRecords(data); setLoading(false); });
    }
  }, [timeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const qty = (cat: OperationsCategory) => records.filter(r => r.category === cat).reduce((s, r) => s + r.quantity, 0);

  const handleSave = async (record: OperationsRecord) => {
    setSaveErr('');
    try {
      if (!DEMO_MODE) await insertOperationsToDB(record);
      setRecords(prev => [record, ...prev]);
      onRecordAdded?.(record);
      setShowForm(false);
    } catch (err) { setSaveErr(err instanceof Error ? err.message : 'Failed to save.'); }
  };

  const handleEdit = async (id: string, patch: Partial<OperationsRecord>) => {
    try {
      if (!DEMO_MODE) await updateOperationsInDB(id, patch);
      setRecords(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
      setEditingId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update record.');
    }
  };
const handleDelete = async (id: string) => {
  if (!confirm('Delete this operations record?')) return;
  try {
   if (!DEMO_MODE) await softDeleteOperationsRecord(id);
    setRecords(prev => prev.filter(r => r.id !== id));
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to delete record.');
  }
};
  return (
    <>
    
      {selected && <OperationsDrillDown category={selected} records={records} onClose={() => setSelected(null)} />}

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h2>Operations Activity</h2>
            <div className="small">Systems shipped, installations and spares · {getTimeFilterLabel(timeFilter)}</div>
          </div>
          {!showForm && (
            <button className="save-button" style={{ marginTop: 0, flexShrink: 0 }} onClick={() => setShowForm(true)}>
              + Log Operations
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <OperationsEntryForm
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setSaveErr(''); }}
          activeTeamMembers={activeTeamMembers}
        />
      )}

      {saveErr && (
        <div style={{ fontSize: 13, color: 'var(--color-critical)', padding: '10px 14px', background: 'rgba(239,68,68,.08)', borderRadius: 10, marginBottom: 14 }}>
          {saveErr}
        </div>
      )}

      {loading ? (
        <div className="card"><div className="panel-empty"><div className="panel-empty-icon">⏳</div><div>Loading operations records…</div></div></div>
      ) : (
        <div className="grid three">
          {OPERATIONS_CATEGORIES.map(cat => (
            <div key={cat} className="card kpi-clickable" role="button" tabIndex={0}
              onClick={() => setSelected(cat)} onKeyDown={e => e.key === 'Enter' && setSelected(cat)}>
              <div className="kpi-label">{cat}</div>
              <div className="kpi-value">{qty(cat)}</div>
              <div className="small">{qty(cat) > 0 ? `${records.filter(r => r.category === cat).length} record${records.filter(r => r.category === cat).length !== 1 ? 's' : ''}` : 'No records this period'}</div>
            </div>
          ))}
        </div>
      )}

      {!loading && records.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 className="section-title">All Records</h2>
          <table className="table">
            <thead><tr><th>Category</th><th>Qty</th><th>Employee</th><th>Date</th><th>Status</th><th>Notes</th><th></th></tr></thead>
            <tbody>
              {records.flatMap(r => {
                const rows = [
                  <tr key={r.id}>
                    <td><span className="pill" style={{ fontSize: 11 }}>{r.category}</span></td>
                    <td style={{ fontWeight: 700, color: 'var(--color-completed)' }}>{r.quantity}</td>
                    <td>{r.employeeName}</td>
                    <td>{r.date}</td>
                    <td><span className={`status-badge ${r.status === 'Completed' ? 'status-completed' : 'status-in-progress'}`}>{r.status}</span></td>
                    <td><span className="small">{r.notes || '—'}</span></td>
                    <td style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {authUserEmail && r.employeeId === authUserEmail && editingId !== r.id && (
                        <button onClick={() => setEditingId(r.id)} style={{ background: 'none', border: 'none', color: 'var(--color-accent)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}>Edit</button>
                      )}
                      {authUserEmail && r.employeeId === authUserEmail && editingId !== r.id && (
                        <button onClick={() => handleDelete(r.id)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}>Delete</button>
                      )}
                    </td>
                  </tr>,
                ];
                if (editingId === r.id) {
                  rows.push(
                    <tr key={`edit-${r.id}`}>
                      <td colSpan={7} style={{ padding: 0 }}>
                        <div style={{ padding: '0 10px 10px' }}>
                          <OperationsEntryForm
                            initialRecord={r}
                            onSave={rec => handleEdit(r.id, rec)}
                            onCancel={() => setEditingId(null)}
                            activeTeamMembers={activeTeamMembers}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                }
                return rows;
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && records.length === 0 && (
        <div className="card" style={{ marginTop: 8 }}>
          <div className="panel-empty">
            <div className="panel-empty-icon">📋</div>
            <div>No operations records for this period. Use <b>+ Log Operations</b> to add one.</div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Metric pages (Logistics / Deployments) ────────────────────────────────

function MetricPage({ title, intro, rows }: { title: string; intro: string; rows: { metric: string; value: string; detail: string; alert?: boolean }[] }) {
  return (
    <>
      <div className="page-header">
        <h2>{title}</h2>
        <div className="small">{intro}</div>
      </div>
      <div className="grid kpis">
        {rows.map(r => (
          <div className={`card${r.alert ? ' card-alert' : ''}`} key={r.metric}>
            <div className="kpi-label">{r.metric}</div>
            <div className="kpi-value">{r.value}</div>
            <div className="small">{r.detail}</div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Cross Functional Support (fully derived) ──────────────────────────────

function Support({ timeFilter, supportLogs }: { timeFilter: TimeFilter; supportLogs: SupportLog[] }) {
  const filtered = filterLogsByTimeFilter(supportLogs, timeFilter);
  const byDept   = buildSupportByDept(filtered);
  const impacts: Record<string, string> = {
    'R&D': 'Urgent builds, testing support',
    'Defence': 'Project procurement and shipments',
    'Product': 'Operational enablement',
    'Finance': 'Supplier payments',
    'Customer Success': 'Customer coordination',
    'Sales': 'Sales support and enablement',
    'Operations': 'Internal operations support',
  };

  return (
    <>
      <div className="page-header">
        <h2>Cross Functional Support</h2>
        <div className="small">Operations support hours by department · {getTimeFilterLabel(timeFilter)}</div>
      </div>
      <div className="card">
        {byDept.length === 0 ? (
          <div className="panel-empty"><div className="panel-empty-icon">📊</div><div>No support hours logged for this period</div></div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Department</th><th>Support Hours</th><th>Activities</th><th>Primary Impact</th></tr>
            </thead>
            <tbody>
              {byDept.map(({ name, hours }) => {
                const activities = filtered.filter(l => parseDepts(l.department).includes(name)).length;
                return (
                  <tr key={name}>
                    <td><b>{name}</b></td>
                    <td>{fmtHours(hours)}h</td>
                    <td>{activities}</td>
                    <td>{impacts[name] ?? 'Cross-functional support'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ─── Highlights ────────────────────────────────────────────────────────────

function Highlights({ timeFilter, supportLogs, activeTeamMembers }: {
  timeFilter: TimeFilter;
  supportLogs: SupportLog[];
  activeTeamMembers: TeamMember[];
}) {
  const [procRecords,     setProcRecords]     = useState<ProcurementRecord[]>(DEMO_MODE ? mockProcurementRecords : []);
  const [prevProcRecords, setPrevProcRecords] = useState<ProcurementRecord[]>([]);

  useEffect(() => {
    const prev = getPreviousPeriod(timeFilter);
    const filterMock = (tf: typeof timeFilter) => {
      const { start, end } = getDateRangeForFilter(tf);
      end.setHours(23, 59, 59, 999);
      return mockProcurementRecords.filter(r => {
        const d = new Date(r.date + 'T00:00:00');
        return d >= start && d <= end;
      });
    };
    if (DEMO_MODE) { setProcRecords(filterMock(timeFilter)); setPrevProcRecords(filterMock(prev)); }
    else { fetchProcurementFromDB(timeFilter).then(setProcRecords); fetchProcurementFromDB(prev).then(setPrevProcRecords); }
  }, [timeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered     = filterLogsByTimeFilter(supportLogs, timeFilter);
  const prevFiltered = filterLogsByTimeFilter(supportLogs, getPreviousPeriod(timeFilter));

  const c = {
    activities: filtered.length,
    hours:      filtered.reduce((s, l) => s + l.hours, 0),
    po:         procRecords.filter(r => r.category === 'PO Created').length,
    emergency:  procRecords.filter(r => r.category === 'Emergency Request').length,
    payments:   procRecords.filter(r => r.category === 'Supplier Payment').length,
  };
  const p = {
    activities: prevFiltered.length,
    hours:      prevFiltered.reduce((s, l) => s + l.hours, 0),
    po:         prevProcRecords.filter(r => r.category === 'PO Created').length,
    emergency:  prevProcRecords.filter(r => r.category === 'Emergency Request').length,
    payments:   prevProcRecords.filter(r => r.category === 'Supplier Payment').length,
  };

  const byDept = buildSupportByDept(filtered);
  const contributors = activeTeamMembers.map(m => ({
    name: m.name, role: m.role,
    hours:      filtered.filter(l => l.employeeName === m.name).reduce((s, l) => s + l.hours, 0),
    activities: filtered.filter(l => l.employeeName === m.name).length,
  })).filter(x => x.activities > 0).sort((a, b) => b.hours - a.hours);

  const hasData = c.activities > 0 || c.po > 0 || c.emergency > 0 || c.payments > 0;

  const exportReport = () => {
    const period = getTimeFilterLabel(timeFilter);
    const pad = (s: string, n: number) => s.padEnd(n);
    let t = `OPSPULSE OPERATIONS SUMMARY\n${'='.repeat(44)}\n`;
    t += `Period:    ${period}\n`;
    t += `Generated: ${new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}\n\n`;
    t += `ACTIVITY\n`;
    t += `${pad('Activities Completed:', 26)}${c.activities}\n`;
    t += `${pad('Support Hours:', 26)}${fmtHours(c.hours)}h\n\n`;
    t += `PROCUREMENT\n`;
    t += `${pad('PO Created:', 26)}${c.po}\n`;
    t += `${pad('Emergency Requests:', 26)}${c.emergency}\n`;
    t += `${pad('Supplier Payments:', 26)}${c.payments}\n`;
    if (byDept.length > 0) {
      t += `\nSUPPORT BY DEPARTMENT\n`;
      byDept.forEach(d => { t += `${pad(d.name, 24)}${fmtHours(d.hours)}h\n`; });
    }
    if (contributors.length > 0) {
      t += `\nTOP CONTRIBUTORS\n`;
      contributors.forEach(x => { t += `${pad(x.name, 24)}${fmtHours(x.hours)}h · ${x.activities} activities\n`; });
    }
    const slug = period.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
    const blob = new Blob([t], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `opspulse-${slug}.txt` });
    a.click();
    URL.revokeObjectURL(url);
  };

  const metrics = [
    { label: 'Activities Completed', cur: c.activities, prev: p.activities, fmt: String },
    { label: 'Support Hours',        cur: c.hours,      prev: p.hours,      fmt: (n: number) => `${fmtHours(n)}h` },
    { label: 'PO Created',           cur: c.po,         prev: p.po,         fmt: String },
    { label: 'Emergency Requests',   cur: c.emergency,  prev: p.emergency,  fmt: String },
    { label: 'Supplier Payments',    cur: c.payments,   prev: p.payments,   fmt: String },
  ];

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h2>Operational Highlights</h2>
            <div className="small">Auto-generated executive summary · {getTimeFilterLabel(timeFilter)}</div>
          </div>
          {hasData && (
            <button className="save-button" style={{ marginTop: 0, flexShrink: 0 }} onClick={exportReport}>
              Export Summary ↓
            </button>
          )}
        </div>
      </div>

      {!hasData ? (
        <div className="card">
          <div className="panel-empty">
            <div className="panel-empty-icon">📊</div>
            <div>No activity data for this period.</div>
            <div className="small" style={{ marginTop: 6 }}>
              Log activities via <b>Add Weekly Activity</b> or <b>Procurement</b>.
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid hl-metrics" style={{ marginBottom: 16 }}>
            {metrics.map(m => {
              const d = formatDelta(m.cur, m.prev);
              const dcls = d.isNeutral ? 'exec-delta-neutral' : d.isPositive ? 'exec-delta-up' : 'exec-delta-down';
              return (
                <div key={m.label} className="card">
                  <div className="kpi-label">{m.label}</div>
                  <div className="kpi-value" style={{ fontSize: 28 }}>{m.fmt(m.cur)}</div>
                  <div className={`card-delta ${dcls}`}>{d.text}</div>
                </div>
              );
            })}
          </div>

          {byDept.length > 0 && (
            <div className="card" style={{ marginBottom: 14 }}>
              <h2 className="section-title">Support by Department</h2>
              <table className="table">
                <thead><tr><th>Department</th><th>Hours</th><th>Activities</th></tr></thead>
                <tbody>
                  {byDept.map(({ name, hours }) => (
                    <tr key={name}>
                      <td><b>{name}</b></td>
                      <td style={{ fontWeight: 700, color: 'var(--color-completed)' }}>{fmtHours(hours)}h</td>
                      <td>{filtered.filter(l => parseDepts(l.department).includes(name)).length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {contributors.length > 0 && (
            <div className="card">
              <h2 className="section-title">Top Contributors</h2>
              <table className="table">
                <thead><tr><th>Employee</th><th>Hours</th><th>Activities</th></tr></thead>
                <tbody>
                  {contributors.map(x => (
                    <tr key={x.name}>
                      <td><b>{x.name}</b><div className="small">{x.role}</div></td>
                      <td style={{ fontWeight: 700, color: 'var(--color-completed)' }}>{fmtHours(x.hours)}h</td>
                      <td>{x.activities}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ─── Activity Feed (derived from SupportLog) ───────────────────────────────

function ActivityFeed({ timeFilter, allActivities, supportLogs, authUserEmail, onUpdateLog }: {
  timeFilter:    TimeFilter;
  allActivities: UnifiedActivity[];
  supportLogs:   SupportLog[];   // kept for edit functionality (SupportLogEditPanel needs full SupportLog)
  authUserEmail?: string;
  onUpdateLog?: (id: string, patch: Partial<SupportLog>) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
const handleDelete = (id: string) => {
  if (!confirm('Delete this activity?')) return;

  if (onUpdateLog) {
    onUpdateLog(id, { deletedAt: new Date().toISOString() } as Partial<SupportLog>);
  }
};
  const { start, end } = getDateRangeForFilter(timeFilter);
  end.setHours(23, 59, 59, 999);
  const items = allActivities.filter(a => {
  const d = new Date(a.date + 'T00:00:00');

  return (
    d >= start &&
    d <= end &&
!(a as any).deletedAt  );
});

  const typeLabel: Record<string, string> = {
    support: '🕐 Support', procurement: '📄 Procurement', operations: '📦 Operations',
  };
  const typeColor: Record<string, string> = {
    support: 'var(--color-completed)', procurement: 'var(--color-warning)', operations: 'var(--color-accent)',
  };

  return (
    <>
      <div className="page-header">
        <h2>Operations Activity Feed</h2>
        <div className="small">All activity types · {getTimeFilterLabel(timeFilter)}</div>
      </div>
      {items.length === 0 ? (
        <div className="card"><div className="panel-empty"><div className="panel-empty-icon">📋</div><div>No activities logged for this period</div></div></div>
      ) : (
        <div className="timeline">
          {items.map(a => {
            const l = a.type === 'support' ? supportLogs.find(s => s.id === a.id) : null;
            return (
            <div key={a.id} className="event">
              <div><span className="pill">{a.date}</span></div>
              <div style={{ flex: 1 }}>
                {l && editingId === a.id ? (
                  <SupportLogEditPanel
                    log={l}
                    onSave={patch => {
                      onUpdateLog?.(a.id, patch);
                      setEditingId(null);
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <>
                    <span className="pill" style={{ fontSize:10, color: typeColor[a.type] }}>{typeLabel[a.type]}</span>
                    {' '}
                    <span className="pill">{a.category}</span>
                    <h3 style={{ margin: '6px 0 4px', fontSize: 15 }}>{a.title}</h3>
                    {a.amountUsd != null && a.amountUsd > 0 && (
                      <MoneyCell record={{ amountUsd: a.amountUsd, originalAmount: a.originalAmount, originalCurrency: a.originalCurrency }} />
                    )}
                    {a.quantity != null && <span style={{ fontSize:12, color:'var(--color-accent)', fontWeight:700 }}> {a.quantity} units</span>}
                    {a.notes && <div className="small">{a.notes}</div>}
                    <div className="event-meta">
                      <span className="owner-tag">↳ {a.employeeName}</span>
                      {a.hours != null && <span className="status-badge status-completed">{fmtHours(a.hours)}h</span>}
                      {authUserEmail && a.employeeId === authUserEmail && (
                        <span>
                          <button
                            onClick={() => setEditingId(a.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--color-accent)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(a.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--color-danger)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0, marginLeft: 8 }}
                          >
                            Delete
                          </button>
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ─── Add Weekly Activity (primary contribution logging engine) ─────────────

function AddWeeklyActivity({
  addLog, activeTeamMembers, onUpdateLog,
}: {
  addLog: (log: SupportLog) => void;
  activeTeamMembers: TeamMember[];
  onUpdateLog?: (id: string, patch: Partial<SupportLog>) => void;
}) {
  const [employeeId,  setEmployeeId]  = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [category,    setCategory]    = useState<string>(ACTIVITY_CATEGORIES[0]);
  const [title,       setTitle]       = useState('');
  const [hours,       setHours]       = useState('');
  const [date,        setDate]        = useState(new Date().toISOString().slice(0, 10));
  const [notes,       setNotes]       = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [recent,      setRecent]      = useState<SupportLog[]>([]);
  const [editingId,   setEditingId]   = useState<string | null>(null);

  const handleDelete = (id: string) => {
    if (!confirm('Delete this activity?')) return;
    setRecent(prev => prev.filter(l => l.id !== id));
    onUpdateLog?.(id, { deletedAt: new Date().toISOString() });
  };

  const save = async () => {
    const member = activeTeamMembers.find(m => m.id === employeeId);
    if (!member || !title.trim() || !hours || parseFloat(hours) <= 0 || departments.length === 0) {
      alert('Please fill in all required fields (Employee, Department, Title, Hours).');
      return;
    }
    const logId = `LOG-${Date.now()}`;
    const log: SupportLog = {
      id: logId,
      employeeId,
      employeeName: member.name,
      department: departments.join(', '),
      category,
      title,
      hours: parseFloat(hours),
      date: date && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? date
        : new Date().toISOString().slice(0, 10),
      week: getWeekTag(date),
      notes,
    };
    addLog(log);
    if (pendingFile && !DEMO_MODE) {
      try {
        await uploadAttachmentFile(pendingFile, 'support_log', logId);
      } catch (err) {
        console.error('Attachment upload failed:', err);
      }
    }
    setRecent(prev => [log, ...prev]);
    setTitle(''); setHours(''); setNotes('');
    setDepartments([]); setPendingFile(null);
  };

  const toggleDept = (d: string) =>
    setDepartments(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  return (
    <>
      <div className="page-header">
        <h2>Add Weekly Activity</h2>
        <div className="small">Log completed support and operational contributions. All submissions update the dashboard in real time.</div>
      </div>

      <div className="card">
        <h2 className="section-title">Log Contribution</h2>
        <AttachmentWidget
          recordType="support_log"
          recordId={undefined}
          pendingFile={pendingFile}
          onPendingFileChange={setPendingFile}
        />
        <div className="grid two">
          <div>
            {/*
              auth-note: once login is added, employeeId will be set from session
              and this field will be auto-filled + locked for regular users.
              Admins/managers may retain the ability to log on behalf of others.
            */}
            <div className="kpi-label">Employee *</div>
            <select className="input" value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
              <option value="">— Select employee —</option>
              {activeTeamMembers.length === 0
                ? <option disabled>Loading team…</option>
                : activeTeamMembers.map(m => <option key={m.id} value={m.id}>{m.name} · {m.role}</option>)
              }
            </select>
            <div className="form-note">For now, select the employee manually. This will be auto-filled after login is added.</div>
          </div>
          <div>
            <div className="kpi-label">Department Supported *</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: 6 }}>
              {SUPPORT_DEPARTMENTS.map(d => (
                <label key={d} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, cursor: 'pointer', color: departments.includes(d) ? 'var(--color-accent)' : 'var(--color-muted)' }}>
                  <input type="checkbox" checked={departments.includes(d)} onChange={() => toggleDept(d)} style={{ accentColor: 'var(--color-accent)' }} />
                  {d}
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="kpi-label">Activity Type / Category</div>
            <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
              {ACTIVITY_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="kpi-label">Hours Invested *</div>
            <input className="input" type="number" min="0.5" step="0.5" value={hours} onChange={e => setHours(e.target.value)} placeholder="e.g. 2.5" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="kpi-label">Activity Title *</div>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Test system preparation for R&D sprint" />
          </div>
          <div>
            <div className="kpi-label">Activity Date</div>
            <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <div className="kpi-label">Notes</div>
            <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional context or outcome" />
          </div>
        </div>
        <button className="save-button" onClick={save}>Log Activity</button>
      </div>

      {recent.length > 0 && (
        <div className="card">
          <h2 className="section-title">Submitted This Session</h2>
         <table className="table">
  <thead>
    <tr>
      <th>Employee</th>
      <th>Department</th>
      <th>Activity</th>
      <th>Hours</th>
      <th>Date</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
{recent.flatMap(l => {
  const rows = [
    <tr key={l.id}>
      <td>{l.employeeName}</td>
      <td>{parseDepts(l.department).map(d => <span key={d} className="pill" style={{ fontSize: 11, marginRight: 3 }}>{d}</span>)}</td>
      <td><b>{l.title}</b>{l.notes && <div className="small">{l.notes}</div>}</td>
      <td style={{ fontWeight: 700, color: 'var(--color-completed)' }}>{fmtHours(l.hours)}h</td>
      <td>{l.date}</td>
      <td>
        {editingId !== l.id && (
          <span style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setEditingId(l.id)} style={{ background: 'none', border: 'none', color: 'var(--color-accent)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}>Edit</button>
            <button onClick={() => handleDelete(l.id)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}>Delete</button>
          </span>
        )}
        {editingId === l.id && (
          <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}>Cancel</button>
        )}
      </td>
    </tr>,
  ];
  if (editingId === l.id) {
    rows.push(
      <tr key={`edit-${l.id}`}>
        <td colSpan={6} style={{ padding: 0 }}>
          <SupportLogEditPanel
            log={l}
            onSave={patch => {
              const updated = { ...l, ...patch };
              setRecent(prev => prev.map(x => x.id === l.id ? updated : x));
              onUpdateLog?.(l.id, patch);
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
          />
        </td>
      </tr>
    );
  }
  return rows;
})}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ─── App ───────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage]           = useState('Executive Dashboard');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(currentTimeFilter);
  const [showSearch, setShowSearch] = useState(false);

  // ── Demo Mode state ──────────────────────────────────────────────────────
  const [userLogs, setUserLogs] = useState<SupportLog[]>([]);

  // ── Production Mode state ────────────────────────────────────────────────
  const [dbLogs,         setDbLogs]         = useState<SupportLog[]>([]);
  const [dbTeamMembers,  setDbTeamMembers]   = useState<TeamMember[]>([]);
  const [dbProcRecords,  setDbProcRecords]   = useState<ProcurementRecord[]>([]);
  const [dbOpsRecords,   setDbOpsRecords]    = useState<OperationsRecord[]>([]);
  const [authUser,       setAuthUser]        = useState<{ id: string; email: string } | null>(null);
  const [dbLoading,      setDbLoading]       = useState(!DEMO_MODE);

  // ── Bootstrap ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (DEMO_MODE) {
      const saved = loadUserLogs();
      if (saved.length > 0) setUserLogs(saved);
    } else {
      // Verify session (middleware already redirects if no session)
      const supabase = createClient();
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (user) {
          setAuthUser({ id: user.id, email: user.email ?? '' });
          try {
            // Fetch all data sources in parallel for the unified activity stream
            const tf = currentTimeFilter();
            const [logs, members, proc, ops] = await Promise.all([
              fetchLogsFromDB(),
              fetchTeamMembersFromDB(),
              fetchProcurementFromDB(tf).catch(() => [] as ProcurementRecord[]),
              fetchOperationsFromDB(tf).catch(() => [] as OperationsRecord[]),
            ]);
            setDbLogs(logs);
            if (members.length > 0) setDbTeamMembers(members);
            setDbProcRecords(proc);
            setDbOpsRecords(ops);
          } catch (fetchErr) {
            console.error('Bootstrap fetch failed:', fetchErr);
          }
        }
        setDbLoading(false);
      });
    }
  }, []);

  // ── Re-fetch proc/ops for the unified stream when timeFilter changes ─────
  // The bootstrap fetches once with the initial filter; this keeps the unified
  // activity stream (and Team Last Updates) current when the user changes periods.
  useEffect(() => {
    if (DEMO_MODE || !authUser) return;
    fetchProcurementFromDB(timeFilter).then(setDbProcRecords).catch(() => {});
    fetchOperationsFromDB(timeFilter).then(setDbOpsRecords).catch(() => {});
  }, [timeFilter, authUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Global search keyboard shortcut (Cmd+K / Ctrl+K) ────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(v => !v);
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  // ── Real-time: push inserts from other users into local state ────────────
  // Requires "Realtime" enabled on the support_logs table in Supabase dashboard.
  useEffect(() => {
    if (DEMO_MODE) return;
    const supabase = createClient();
    const channel = supabase
      .channel('opspulse:logs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_logs' },
        (payload) => {
          const newLog = rowToLog(payload.new as Record<string, unknown>);
          setDbLogs(prev => (prev.some(l => l.id === newLog.id) ? prev : [newLog, ...prev]));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived log array ─────────────────────────────────────────────────────
  // Demo  → localStorage submissions + seed data
  // Prod  → only real DB records (seed data hidden)
  const supportLogs: SupportLog[] = DEMO_MODE
    ? [...userLogs, ...seedSupportLogs]
    : dbLogs;

  // ── Active team members ───────────────────────────────────────────────────
  const activeTeamMembers: TeamMember[] = DEMO_MODE
    ? teamMembers
    : (dbTeamMembers.length > 0 ? dbTeamMembers : teamMembers);

  // ── Unified activity stream ───────────────────────────────────────────────
  // Merges support_logs + procurement_records + operations_records.
  // Used by Activity Feed, Team Last Updates, and Team Contributions.
  const procForStream: ProcurementRecord[]  = DEMO_MODE ? mockProcurementRecords : dbProcRecords;
  const opsForStream:  OperationsRecord[]   = DEMO_MODE ? mockOperationsRecords  : dbOpsRecords;
  const allActivities = buildUnifiedActivities(supportLogs, procForStream, opsForStream);

  // ── Add log ───────────────────────────────────────────────────────────────
  const addLog = async (log: SupportLog) => {
    if (DEMO_MODE) {
      setUserLogs(prev => {
        const updated = [log, ...prev];
        persistUserLogs(updated);
        return updated;
      });
    } else {
      try {
        await insertLogToDB(log, authUser!.id, authUser!.email);
        setDbLogs(prev => [log, ...prev]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        alert(`Failed to save activity: ${msg}`);
      }
    }
  };

  // ── Update support log (edit own record) ─────────────────────────────────
  const updateLog = async (id: string, patch: Partial<SupportLog>) => {
    try {
      if (!DEMO_MODE) await updateSupportLogInDB(id, patch);
      setDbLogs(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
      setUserLogs(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update activity.');
    }
  };

  // ── Sign out ──────────────────────────────────────────────────────────────
  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  // ── Loading screen (production only, first paint) ─────────────────────────
  if (dbLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#07111f', color: '#8fa3bb', fontFamily: 'Inter, sans-serif', fontSize: 14 }}>
        Loading OpsPulse…
      </div>
    );
  }

  let content = <Executive timeFilter={timeFilter} supportLogs={supportLogs} activeTeamMembers={activeTeamMembers} allActivities={allActivities} />;
  if (page === 'Team Contributions')           content = <TeamContributions timeFilter={timeFilter} supportLogs={supportLogs} activeTeamMembers={activeTeamMembers} />;
  
  if (page === 'Procurement')                  content = <ProcurementPage timeFilter={timeFilter} activeTeamMembers={activeTeamMembers} authUserEmail={authUser?.email} authUserId={authUser?.id} onRecordAdded={r => setDbProcRecords(prev => [r, ...prev.filter(x => x.id !== r.id)])} onRecordDeleted={id => setDbProcRecords(prev => prev.filter(r => r.id !== id))} />;
  if (page === 'Operations')                   content = <OperationsPage  timeFilter={timeFilter} activeTeamMembers={activeTeamMembers} authUserEmail={authUser?.email} onRecordAdded={r => setDbOpsRecords(prev => [r, ...prev.filter(x => x.id !== r.id)])} />;
  if (page === 'Cross Functional Support')     content = <Support timeFilter={timeFilter} supportLogs={supportLogs} />;
  if (page === 'Weekly Highlights')            content = <Highlights timeFilter={timeFilter} supportLogs={supportLogs} activeTeamMembers={activeTeamMembers} />;
  if (page === 'Activity Feed')                content = <ActivityFeed timeFilter={timeFilter} allActivities={allActivities} supportLogs={supportLogs} authUserEmail={authUser?.email} onUpdateLog={updateLog} />;
  if (page === 'Add Weekly Activity')          content = <AddWeeklyActivity addLog={addLog} activeTeamMembers={activeTeamMembers} onUpdateLog={updateLog} />;

  return (
    <>
      <Shell
        page={page} setPage={setPage}
        timeFilter={timeFilter} onTimeFilterChange={setTimeFilter}
        authEmail={authUser?.email}
        onSignOut={signOut}
        onSearchOpen={() => setShowSearch(true)}
      >
        {content}
      </Shell>
      <GlobalSearch
        open={showSearch}
        onClose={() => setShowSearch(false)}
        procRecords={DEMO_MODE ? mockProcurementRecords : dbProcRecords}
        supportLogs={supportLogs}
        opsRecords={DEMO_MODE ? mockOperationsRecords : dbOpsRecords}
      />
    </>
  );
}
