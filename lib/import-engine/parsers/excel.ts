import type { RawRow } from '../types';

/**
 * Excel parser using SheetJS (xlsx).
 * Returns all sheets names and the rows from the selected sheet.
 */
export async function parseExcel(
  buffer: ArrayBuffer,
  sheetName?: string
): Promise<{ sheets: string[]; rows: RawRow[] }> {
  // Dynamic import keeps xlsx out of the initial bundle
  const XLSX = await import('xlsx');

  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheets = wb.SheetNames;
  const target = sheetName && sheets.includes(sheetName) ? sheetName : sheets[0];
  const ws = wb.Sheets[target];

  // Convert to array of objects; defval: null so missing cells are null not undefined
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });

  const rows: RawRow[] = raw.map(r => {
    const row: RawRow = {};
    for (const [k, v] of Object.entries(r)) {
      if (v === null || v === undefined) {
        row[k] = null;
      } else if (v instanceof Date) {
        row[k] = v.toISOString().slice(0, 10); // YYYY-MM-DD
      } else {
        row[k] = String(v).trim() || null;
      }
    }
    return row;
  });

  return { sheets, rows };
}
