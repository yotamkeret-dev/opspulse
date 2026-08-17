import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  parseExcel,
  isNetSuiteExport,
  NETSUITE_PO_EXACT_MAP,
  mapOraclePORow,
  getHeaders,
  columnMatchesToMap,
} from '@/lib/import-engine';
import type { RawImportMeta } from '@/lib/import-engine';
import { executeProcurementImport } from '@/lib/procurement/import-executor';
import { createServiceClient } from '@/lib/supabase/service';

// ─── Auth ────────────────────────────────────────────────────────────────────

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization') ?? '';
  return auth === `Bearer ${secret}`;
}

// ─── POST /api/procurement/auto-import ──────────────────────────────────────
// Accepts multipart/form-data:
//   file        — Excel attachment (required)
//   company_id  — UUID of the tenant (required)
//   source_id   — opaque deduplcation key for the source event (e.g. email message ID)
//   caller_email — label used in history rows (optional, defaults to "auto-import")

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // ── Parse FormData ──
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_form_data' }, { status: 400 });
  }

  const file       = formData.get('file');
  const companyId  = formData.get('company_id');
  const sourceId   = formData.get('source_id');
  const callerEmail = (formData.get('caller_email') as string | null) ?? 'auto-import';

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }
  if (typeof companyId !== 'string' || !companyId.trim()) {
    return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
  }
  if (typeof sourceId !== 'string' || !sourceId.trim()) {
    return NextResponse.json({ error: 'source_id is required' }, { status: 400 });
  }

  // ── Hash the raw bytes ──
  const buffer = await file.arrayBuffer();
  const hashHex = crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');

  const supabase = createServiceClient();

  // ── Dedup: skip if source_id OR hash already processed ──
  const { data: existing } = await supabase
    .from('auto_import_log')
    .select('id, source_id, attachment_hash')
    .or(`source_id.eq.${sourceId},attachment_hash.eq.${hashHex}`)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ skipped: true, reason: 'already_processed', log_id: existing.id });
  }

  // ── Parse Excel ──
  let rows: import('@/lib/import-engine').RawRow[];
  try {
    const parsed = await parseExcel(buffer);
    rows = parsed.rows;
  } catch (err) {
    await logResult('error', { parse_error: String(err) });
    return NextResponse.json({ error: 'excel_parse_failed', detail: String(err) }, { status: 422 });
  }

  if (rows.length === 0) {
    await logResult('error', { parse_error: 'no rows extracted' });
    return NextResponse.json({ error: 'empty_file' }, { status: 422 });
  }

  const headers = getHeaders(rows);

  // ── Require NetSuite format ──
  if (!isNetSuiteExport(headers)) {
    await logResult('error', { parse_error: 'not a NetSuite export', headers });
    return NextResponse.json({ error: 'unsupported_format', detail: 'File must be a NetSuite PO export' }, { status: 422 });
  }

  type CL = import('@/lib/import-engine').ColumnMatch['confidence'];
  const columnMap = columnMatchesToMap(
    headers.map(h => ({
      sourceColumn: h,
      targetField:  NETSUITE_PO_EXACT_MAP[h] ?? null,
      confidence:   (NETSUITE_PO_EXACT_MAP[h] !== undefined ? 'high' : 'unmapped') as CL,
    }))
  );

  const meta: RawImportMeta = {
    sourceFile:    file.name,
    sourceType:    'excel',
    importedAt:    new Date().toISOString(),
    importVersion: '1.0',
    extractedRows: rows,
  };

  const mapped = rows.map((row, i) => mapOraclePORow(row, columnMap, [], meta, i));

  // ── Execute import ──
  let importResult: Awaited<ReturnType<typeof executeProcurementImport>>;
  try {
    importResult = await executeProcurementImport(mapped, {
      supabase,
      companyId:           companyId.trim(),
      callerEmail,
      callerId:            null,
      defaultEmployeeName: 'Operations Team',
    });
  } catch (err) {
    await logResult('error', { exec_error: String(err) });
    return NextResponse.json({ error: 'import_failed', detail: String(err) }, { status: 500 });
  }

  const details = {
    rows_parsed: rows.length,
    upserted:    importResult.upserted.length,
    inserted:    importResult.inserted.length,
  };

  await logResult('success', details);

  return NextResponse.json({ ok: true, ...details });

  // ── Helper: write one row to auto_import_log ──
  async function logResult(status: 'success' | 'error', details: Record<string, unknown>) {
    const { error } = await supabase.from('auto_import_log').insert({
      source_id:       sourceId as string,
      attachment_hash: hashHex,
      status,
      details,
      company_id:      (companyId as string).trim(),
    });
    if (error) console.error('auto_import_log insert:', error.message);
  }
}
