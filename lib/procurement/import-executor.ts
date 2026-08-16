import type { SupabaseClient } from '@supabase/supabase-js';
import { convertToUsd } from '@/lib/exchange-rate';
import type { MappedRecord } from '@/lib/import-engine';
import type { ProcurementRecord, SupportLog } from '@/app/data/mock';

// ─── TRACKED_FIELDS ────────────────────────────────────────────────────────────
// Moved from app/page.tsx — defines which fields are written to procurement_history.

export const TRACKED_FIELDS: {
  key: keyof ProcurementRecord;
  label: string;
  format?: (v: unknown) => string;
}[] = [
  { key: 'status',    label: 'Status' },
  { key: 'amountUsd', label: 'Amount (USD)', format: v => `$${Number(v).toLocaleString()}` },
  { key: 'notes',     label: 'Notes' },
  { key: 'date',      label: 'Date' },
  { key: 'category',  label: 'Category' },
  { key: 'supplier',  label: 'Supplier' },
  { key: 'poNumber',  label: 'PO Number' },
];

// ─── normalizeProcurementStatus ────────────────────────────────────────────────
// Moved from app/page.tsx verbatim.

export function normalizeProcurementStatus(status?: string): ProcurementRecord['status'] {
  const s = String(status ?? '').trim().toLowerCase();
  if (s === 'po arrived') return 'PO Arrived';
  if (s === 'po issued')  return 'PO Issued';
  if (
    s.includes('arrived')   || s.includes('delivered') || s.includes('receipt') ||
    s.includes('received')  || s.includes('paid')      || s.includes('closed')  ||
    s.includes('bill')      || s.includes('done')      || s.includes('complet') ||
    s.includes('approved')
  ) return 'PO Arrived';
  return 'PO Issued';
}

// ─── rowToProcurementRecord ────────────────────────────────────────────────────
// Moved from app/page.tsx verbatim.

export function rowToProcurementRecord(row: Record<string, unknown>): ProcurementRecord {
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
    originalAmount:   row.original_amount   != null ? Number(row.original_amount)   : undefined,
    originalCurrency: row.original_currency ? String(row.original_currency) : 'USD',
    exchangeRate:     row.exchange_rate      != null ? Number(row.exchange_rate)      : undefined,
    exchangeRateDate: row.exchange_rate_date ? String(row.exchange_rate_date)         : undefined,
    createdBy:        row.created_by        ? String(row.created_by)                 : undefined,
    deletedAt:        row.deleted_at        ? String(row.deleted_at)                 : undefined,
    deletedBy:        row.deleted_by        ? String(row.deleted_by)                 : undefined,
    deletionReason:   row.deletion_reason   ? String(row.deletion_reason)            : undefined,
  };
}

// ─── getWeekTag ────────────────────────────────────────────────────────────────
// Moved from app/page.tsx verbatim.

export function getWeekTag(dateStr: string): string {
  const d   = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  const thu = new Date(d);
  thu.setDate(d.getDate() - d.getDay() + 4);
  const year    = thu.getFullYear();
  const sun = new Date(d);
  sun.setDate(d.getDate() - d.getDay());
  const jan1    = new Date(year, 0, 1);
  const jan1Sun = new Date(jan1);
  jan1Sun.setDate(jan1.getDate() - jan1.getDay());
  const weekNum = Math.round((sun.getTime() - jan1Sun.getTime()) / (7 * 86400000)) + 1;
  return `W${String(weekNum).padStart(2, '0')}`;
}

// ─── insertProcurementHistoryRows ──────────────────────────────────────────────
// Moved from app/page.tsx. Now accepts an explicit supabase client so it is
// callable from both browser (createClient) and server (createServerSupabase) contexts.

export async function insertProcurementHistoryRows(
  supabase: SupabaseClient,
  recordId: string,
  oldRecord: ProcurementRecord,
  patch: Partial<ProcurementRecord>,
  changedBy: string,
): Promise<void> {
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

// ─── Executor types ────────────────────────────────────────────────────────────

export type ExecutorContext = {
  supabase:            SupabaseClient;
  companyId:           string;
  callerEmail:         string;
  callerId:            string | null;
  defaultEmployeeName: string;
  /** Called for each inserted or updated PO; caller wires this to the activity log. */
  logActivity?:        (entry: SupportLog) => Promise<void>;
};

export type ExecutorResult = {
  /** Updated records (merged patch over existing) — use to refresh local state. */
  upserted: ProcurementRecord[];
  /** Newly inserted records — caller should also invoke onRecordAdded for each. */
  inserted: ProcurementRecord[];
};

// ─── executeProcurementImport ──────────────────────────────────────────────────
// Extracted verbatim from the handleBulkImport loop in app/page.tsx.
// All grouping, merge, FX conversion, status derivation, UPSERT, history, and
// company isolation logic is identical to the original; only the client and
// side-effect callbacks are injected via ExecutorContext.

export async function executeProcurementImport(
  mapped: MappedRecord<ProcurementRecord>[],
  ctx: ExecutorContext,
): Promise<ExecutorResult> {
  const { supabase, companyId, callerEmail, callerId, defaultEmployeeName, logActivity } = ctx;

  const result: ExecutorResult = { upserted: [], inserted: [] };

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
  const mergedMapped: Array<{
    m: MappedRecord<ProcurementRecord>;
    i: number;
    mergeSummary: string | null;
    allMembers: MappedRecord<ProcurementRecord>[];
  }> = [];

  for (const { members, indices } of groupMap.values()) {
    if (members.length === 1) {
      mergedMapped.push({ m: members[0], i: indices[0], mergeSummary: null, allMembers: members });
    } else {
      const base = members[0];
      const totalAmount = members.reduce((s, mr) => s + (mr.data.amountUsd ?? 0), 0);
      const rowNums = indices.map(idx => idx + 2);
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

      const merged: MappedRecord<ProcurementRecord> = {
        ...base,
        data: { ...base.data, amountUsd: totalAmount },
        status: members.some(mr => mr.status === 'needs_review') ? 'needs_review' : base.status,
      };
      mergedMapped.push({ m: merged, i: indices[0], mergeSummary, allMembers: members });
    }
  }

  for (const { m, i, mergeSummary, allMembers } of mergedMapped) {
    const finalEmployeeId   = m.data.employeeId   ?? callerEmail ?? '';
    const finalEmployeeName = m.data.employeeName ?? defaultEmployeeName;
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
    const rawCurrency = String(
      m.rawData['Currency'] ??
      m.rawData['CURRENCY'] ??
      m.rawData['currency'] ??
      m.data.originalCurrency ??
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
      originalAmount:   rawAmount,
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
      createdBy:        callerEmail || undefined,
    };

    // Derive status from total Quantity Remaining across all group rows.
    {
      const hasQtyField = allMembers.some(mr => {
        const v = mr.rawData['Quantity Remaining'];
        return v !== null && v !== undefined && String(v).trim() !== '';
      });
      if (hasQtyField) {
        const totalRemaining = allMembers.reduce((sum, mr) => {
          const n = parseFloat(String(mr.rawData['Quantity Remaining'] ?? '').replace(/[^0-9.]/g, ''));
          return sum + (isNaN(n) ? 0 : n);
        }, 0);
        record.status = totalRemaining === 0 ? 'PO Arrived' : 'PO Issued';
      }
    }

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
        .ilike('po_number', record.poNumber.trim())
        .is('deleted_at', null)
        .or(`company_id.eq.${companyId},company_id.is.null`)
        .maybeSingle();
      if (existingRow) existingRecord = rowToProcurementRecord(existingRow);
    }

    if (existingRecord) {
      // ── UPDATE path ────────────────────────────────────────────────────────
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
          company_id:         companyId,
        })
        .eq('id', existingRecord.id)
        .or(`company_id.eq.${companyId},company_id.is.null`);

      if (updErr) {
        console.error(`import upsert update [${record.poNumber}]:`, updErr.message);
        continue;
      }

      await insertProcurementHistoryRows(supabase, existingRecord.id, existingRecord, patch, callerEmail || 'import');

      const updated = { ...existingRecord, ...patch, id: existingRecord.id };
      result.upserted.push(updated as ProcurementRecord);

      if (callerId && logActivity) {
        const logEntry: SupportLog = {
          id:           `LOG-import-upd-${existingRecord.id}-${Date.now()}`,
          employeeId:   finalEmployeeId,
          employeeName: finalEmployeeName,
          department:   'Operations',
          category:     'Procurement',
          title:        `PO updated via import: ${record.poNumber} — ${record.supplier} — $${(record.amountUsd || 0).toLocaleString()}`,
          hours:        0.1,
          date:         activityDate,
          week:         getWeekTag(activityDate),
          notes:        `Updated via import · Supplier: ${record.supplier} · Total: $${(record.amountUsd || 0).toLocaleString()} · Status: ${record.status}`,
        };
        await logActivity(logEntry).catch(e => console.error('import log:', e.message));
      }
    } else {
      // ── INSERT path ────────────────────────────────────────────────────────
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
          company_id:        companyId,
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

      result.inserted.push(record);

      if (callerId && logActivity) {
        const logEntry: SupportLog = {
          id:           `LOG-import-${record.id}`,
          employeeId:   finalEmployeeId,
          employeeName: finalEmployeeName,
          department:   'Operations',
          category:     'Procurement',
          title:        `PO imported: ${record.poNumber || 'N/A'} — ${record.supplier} — $${(record.amountUsd || 0).toLocaleString()}`,
          hours:        0.1,
          date:         activityDate,
          week:         getWeekTag(activityDate),
          notes:        `Supplier: ${record.supplier} · Total: $${(record.amountUsd || 0).toLocaleString()} · Status: ${record.status}`,
        };
        await logActivity(logEntry).catch(e => console.error('import log:', e.message));
      }
    }
  }

  return result;
}
