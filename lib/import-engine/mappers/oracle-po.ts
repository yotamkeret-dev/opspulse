import type { FieldMappingRule, RawRow, MappedRecord, EmployeeMatch, RawImportMeta } from '../types';
import type { ProcurementRecord, TeamMember } from '@/app/data/mock';

/** Oracle Purchase Order field mapping rules. */
export const ORACLE_PO_RULES: FieldMappingRule[] = [
  {
    targetField:    'poNumber',
    label:          'PO Number',
    sourcePatterns: [
      'PO_NUMBER','PO Number','Purchase Order Number','Order Number','PO NO','PO#','PO No','Order No',
      // NetSuite exact headers
      'Document Number','Document No','Document #',
    ],
    required:       true,
    aiHint:         'Unique purchase order identifier, e.g. PO-4701',
  },
  {
    targetField:    'supplier',
    label:          'Supplier',
    sourcePatterns: [
      'SUPPLIER','VENDOR','VENDOR_NAME','Vendor Name','Supplier Name','Bill To','Vendor',
      // NetSuite exact headers
      'Vendor','Name',
    ],
    required:       true,
    aiHint:         'Supplier or vendor company name',
  },
  {
    targetField:    'date',
    label:          'PO Date',
    sourcePatterns: [
      'PO_DATE','PO Date','Order Date','ORDERED_DATE','Creation Date','Date','Issue Date',
      // NetSuite exact headers
      'Date',
    ],
    required:       false,
    transform:      normaliseDate,
    defaultValue:   () => new Date().toISOString().slice(0, 10),
    aiHint:         'Date the purchase order was created (YYYY-MM-DD)',
  },
  {
    targetField:    'amountUsd',
    label:          'Total Amount',
    sourcePatterns: [
      'TOTAL','Grand Total','AMOUNT','Total Amount','PO Amount','Net Amount','Order Total',
      // NetSuite exact headers (foreign-currency amount column)
      'Amount (Foreign Currency)','Amount Foreign Currency','Foreign Amount','Foreign Currency Amount',
    ],
    required:       false,
    transform:      parseAmount,
    defaultValue:   0,
    aiHint:         'Total monetary value of the PO in the original currency',
  },
  {
    targetField:    'status',
    label:          'Status',
    sourcePatterns: [
      'STATUS','PO Status','State','Order Status',
      // NetSuite exact header
      'Status',
    ],
    required:       false,
    transform:      normaliseStatus,
    defaultValue:   'Open' as const,
    aiHint:         'Current PO status: Open, In Progress, or Completed',
  },
  {
    targetField:    'employeeName',
    label:          'Requester / Owner',
    sourcePatterns: ['REQUESTER','REQUESTER_NAME','Requester','Buyer','Prepared By','Ordered By','Owner','Contact'],
    required:       false,
    aiHint:         'Person who created or is responsible for this PO',
  },
  {
    targetField:    'notes',
    label:          'Notes / Description',
    sourcePatterns: [
      'DESCRIPTION','Notes','Comments','Item Description','LINE_ITEMS','Items',
      // NetSuite exact headers (both map to notes — item details appended together)
      'Description','Item',
    ],
    required:       false,
    transform:      formatNotes,
    defaultValue:   '',
    aiHint:         'Item descriptions or additional notes about the PO',
  },
];

/** ID used when seeding the Oracle PO default template into Supabase. */
export const ORACLE_PO_TEMPLATE_ID = 'oracle-po-v1';

/**
 * Exact column→field map for NetSuite PO export headers.
 * When ALL of these headers are present in the uploaded file,
 * this map is applied directly (no fuzzy scoring needed).
 */
export const NETSUITE_PO_EXACT_MAP: Record<string, string | null> = {
  'Document Number':             'poNumber',
  'Vendor':                      'supplier',
  'Date':                        'date',
  'Amount (Foreign Currency)':   'amountUsd',
  'Currency':                    'originalCurrency',
  'Status':                      'status',
  'Description':                 'notes',
  'Item':                        'notes',
  // Preserved in raw data + appended to notes — no dedicated field
  'Internal ID':                 null,
  'Memo (Main)':                 null,
  'Quantity':                    null,
  'Quantity Fulfilled/Received': null,
  'Quantity Remaining':          null,
  'Expected Receipt Date':       null,
  'Vessel SO':                   null,
  'Created From':                null,
};

/** Headers that must all be present for the NetSuite preset to activate. */
const NETSUITE_REQUIRED_HEADERS = [
  'Document Number',
  'Vendor',
  'Amount (Foreign Currency)',
  'Currency',
  'Expected Receipt Date',
];

/**
 * Normalize a header string the same way the Excel parser does, so comparison
 * is resilient against BOM, non-breaking spaces, and other Unicode whitespace.
 */
function normalizeHeader(h: string): string {
  let out = '';
  for (let i = 0; i < h.length; i++) {
    const c = h.charCodeAt(i);
    if (c === 0x200b || c === 0x200c || c === 0x200d ||
        c === 0x200e || c === 0x200f || c === 0xfeff) continue;
    if (c === 0x00a0 || (c >= 0x2000 && c <= 0x200a) ||
        c === 0x202f || c === 0x205f || c === 0x2028 ||
        c === 0x2029 || c === 0x3000) {
      out += ' ';
    } else {
      out += h[i];
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Returns true if the given header list looks like a NetSuite PO export.
 * Requires the five headers that are unique to NetSuite and not in generic Oracle exports.
 * Normalizes Unicode whitespace on both sides before comparing.
 */
export function isNetSuiteExport(headers: string[]): boolean {
  const set = new Set(headers.map(normalizeHeader));
  return NETSUITE_REQUIRED_HEADERS.every(h => set.has(normalizeHeader(h)));
}

/** NetSuite-specific columns that are preserved in notes even without a target field. */
const NETSUITE_PRESERVED_COLUMNS: { key: string; label: string }[] = [
  { key: 'Internal ID',                 label: 'Internal ID'           },
  { key: 'Memo (Main)',                 label: 'Memo'                  },
  { key: 'Quantity',                    label: 'Quantity'              },
  { key: 'Quantity Fulfilled/Received', label: 'Qty Fulfilled'        },
  { key: 'Quantity Remaining',          label: 'Qty Remaining'         },
  { key: 'Expected Receipt Date',       label: 'Expected Receipt Date' },
  { key: 'Vessel SO',                   label: 'Vessel SO'             },
  { key: 'Created From',                label: 'Created From'          },
];

// ─── Row mapper ────────────────────────────────────────────────────────────

export function mapOraclePORow(
  raw: RawRow,
  columnMap: Record<string, string | null>,
  roster: TeamMember[],
  meta: RawImportMeta,
  index: number
): MappedRecord<ProcurementRecord> {
  const data: Partial<ProcurementRecord> = {};
  const issues: MappedRecord['issues'] = [];

  // Apply each column mapping
  for (const [srcCol, targetField] of Object.entries(columnMap)) {
    if (!targetField) continue;
    const rawVal = raw[srcCol];
    if (rawVal === null || rawVal === undefined || String(rawVal).trim() === '') continue;

    const rule = ORACLE_PO_RULES.find(r => r.targetField === targetField);
    const strVal = String(rawVal).trim();

    try {
      const transformed = rule?.transform ? rule.transform(strVal) : strVal;
      (data as Record<string, unknown>)[targetField] = transformed;
    } catch {
      issues.push({ field: targetField, reason: `Could not parse: "${strVal}"` });
    }
  }

  // Employee matching — try to resolve raw name against team roster
  const rawName = extractEmployeeName(raw);
  if (rawName) {
    const match = matchEmployee(rawName, roster);
    if (match.confidence >= 0.85) {
      data.employeeId   = match.memberId;
      data.employeeName = match.memberName;
    } else if (match.confidence >= 0.55) {
      data.employeeId   = match.memberId;
      data.employeeName = match.memberName ?? rawName;
      issues.push({
        field:  'employeeName',
        reason: `Auto-matched "${rawName}" → "${match.memberName}" (${Math.round(match.confidence * 100)}% confidence — please confirm)`,
      });
    } else {
      data.employeeName = rawName;
      issues.push({
        field:  'employeeName',
        reason: `Could not match "${rawName}" to a team member — please assign manually`,
      });
    }
  }

  // Build a structured item block for this row.
  // Item and Description both target 'notes' in the column map, so only the
  // last one processed survives the mapping loop. Read all three directly from
  // raw to guarantee nothing is lost.
  const rawItem = String(raw['Item'] ?? '').trim();
  const rawDesc = String(raw['Description'] ?? '').trim();
  const rawQty  = String(raw['Quantity'] ?? '').trim();
  const itemLines: string[] = [];
  if (rawItem) itemLines.push(`Item: ${rawItem}`);
  if (rawDesc && rawDesc !== rawItem) itemLines.push(`Description: ${rawDesc}`);
  if (rawQty)  itemLines.push(`Quantity: ${rawQty}`);

  // Preserved metadata columns — compact single line.
  // Quantity is already shown in the item block above; skip it here.
  const preservedLines = NETSUITE_PRESERVED_COLUMNS
    .filter(({ key }) => key !== 'Quantity')
    .map(({ key, label }) => {
      const val = raw[key];
      return val !== null && val !== undefined && String(val).trim()
        ? `${label}: ${String(val).trim()}`
        : null;
    })
    .filter(Boolean) as string[];

  // Assemble: structured item block first, then preserved metadata line
  const noteParts: string[] = [];
  if (itemLines.length > 0)     noteParts.push(itemLines.join('\n'));
  if (preservedLines.length > 0) noteParts.push(preservedLines.join(' · '));
  if (noteParts.length > 0)     data.notes = noteParts.join('\n');

  // Apply defaults for missing optional fields
  if (!data.category)  data.category  = 'PO Created';
  if (!data.status) data.status = 'PO Issued';
  if (!data.notes)     data.notes     = '';
  if (!data.amountUsd) data.amountUsd = 0;
  if (!data.date) {
    data.date = new Date().toISOString().slice(0, 10);
    issues.push({ field: 'date', reason: 'Date not found — defaulted to today' });
  }

  // Required field validation
  if (!data.supplier?.trim()) issues.push({ field: 'supplier', reason: 'Supplier is required' });

  const status: 'ready' | 'needs_review' =
    issues.length === 0 && Boolean(data.supplier) ? 'ready' : 'needs_review';
  const confidence = Math.max(0, 1 - issues.length * 0.18);

  return {
    id:         `imp-${Date.now()}-${index}`,
    data,
    rawData:    raw,
    status,
    issues,
    confidence,
    rawImport:  meta,
  };
}

// ─── Transforms ───────────────────────────────────────────────────────────

function normaliseDate(raw: string): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  // YYYY-MM-DD or YYYY/MM/DD
  const iso = raw.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2,'0')}-${iso[3].padStart(2,'0')}`;
  // DD/MM/YYYY or MM/DD/YYYY — assume MM/DD/YYYY (Oracle default)
  const mdy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2,'0')}-${mdy[2].padStart(2,'0')}`;
  // DD/MM/YY
  const short = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (short) return `20${short[3]}-${short[1].padStart(2,'0')}-${short[2].padStart(2,'0')}`;
  return new Date().toISOString().slice(0, 10);
}

function parseAmount(raw: string): number {
  const cleaned = String(raw).replace(/[^0-9.]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function normaliseStatus(raw: string): 'Open' | 'In Progress' | 'Completed' {
  const l = (raw || '').toLowerCase().trim();
  if (['approved','complete','completed','closed','received','fulfilled'].includes(l)) return 'Completed';
  if (['in progress','pending','processing','partial','in-progress'].includes(l)) return 'In Progress';
  return 'Open';
}

function formatNotes(raw: string): string {
  if (!raw) return '';
  try {
    const items = JSON.parse(raw) as Array<Record<string, string>>;
    if (Array.isArray(items) && items.length > 0) {
      return (
        'Imported line items:\n' +
        items
          .map((item, i) =>
            `${i + 1}. ${item.description ?? 'Item'} — Qty: ${item.quantity ?? '?'} × $${item.unitPrice ?? '?'} = $${item.amount ?? '?'}`
          )
          .join('\n')
      );
    }
  } catch {
    // not JSON — return as plain text
  }
  return raw.trim().slice(0, 500);
}

// ─── Employee matching ────────────────────────────────────────────────────

function extractEmployeeName(row: RawRow): string {
  const candidates = [
    'REQUESTER','REQUESTER_NAME','Requester','Buyer','Prepared By','Ordered By','Owner','Contact',
  ];
  for (const key of candidates) {
    const val = row[key];
    if (val && String(val).trim()) return String(val).trim();
  }
  return '';
}

export function matchEmployee(name: string, roster: TeamMember[]): EmployeeMatch {
  const norm = name.toLowerCase().trim();

  // Exact full name match
  const exact = roster.find(m => m.name.toLowerCase() === norm);
  if (exact) {
    return { memberId: exact.id, memberName: exact.name, confidence: 1.0, isAutomatic: true };
  }

  // Token overlap
  const nameParts = norm.split(/[\s,]+/).filter(p => p.length > 1);
  let best: { member: TeamMember; score: number } | null = null;

  for (const member of roster) {
    const memberParts = member.name.toLowerCase().split(/\s+/);
    const overlap = nameParts.filter(p =>
      memberParts.some(mp => mp.startsWith(p) || p.startsWith(mp))
    ).length;
    const score = overlap / Math.max(nameParts.length, memberParts.length);
    if (!best || score > best.score) best = { member, score };
  }

  if (best && best.score >= 0.55) {
    return {
      memberId:    best.member.id,
      memberName:  best.member.name,
      confidence:  best.score,
      isAutomatic: best.score >= 0.85,
    };
  }
  return { confidence: 0, isAutomatic: false };
}
