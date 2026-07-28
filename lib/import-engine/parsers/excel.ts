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

  /**
   * Normalize a column key from an Excel header cell.
   *
   * NetSuite (and other ERP) Excel exports frequently embed:
   *   - U+00A0  non-breaking space
   *   - U+200B  zero-width space
   *   - U+200C  zero-width non-joiner
   *   - U+200D  zero-width joiner
   *   - U+FEFF  BOM / zero-width no-break space
   *   - U+2000–U+200A  en/em/thin/hair space variants
   *   - U+202F  narrow no-break space
   *   - U+205F  medium mathematical space
   *   - U+3000  ideographic space
   *
   * We convert all of these to a plain ASCII space, collapse runs, then trim,
   * so "Amount (Foreign Currency)" becomes "Amount (Foreign Currency)".
   */
  function normalizeKey(k: string): string {
    let out = '';
    for (let i = 0; i < k.length; i++) {
      const c = k.charCodeAt(i);
      // Drop invisible zero-width / BOM characters entirely
      if (
        c === 0x200b || // zero-width space
        c === 0x200c || // zero-width non-joiner
        c === 0x200d || // zero-width joiner
        c === 0x200e || // left-to-right mark
        c === 0x200f || // right-to-left mark
        c === 0xfeff    // BOM / zero-width no-break space
      ) {
        continue;
      }
      // Convert Unicode space variants to regular ASCII space
      if (
        c === 0x00a0 ||                       // non-breaking space
        (c >= 0x2000 && c <= 0x200a) ||       // en quad … hair space
        c === 0x202f ||                       // narrow no-break space
        c === 0x205f ||                       // medium mathematical space
        c === 0x2028 ||                       // line separator
        c === 0x2029 ||                       // paragraph separator
        c === 0x3000                          // ideographic space
      ) {
        out += ' ';
      } else {
        out += k[i];
      }
    }
    return out.replace(/\s+/g, ' ').trim();
  }

  const rows: RawRow[] = raw.map(r => {
    const row: RawRow = {};
    for (const [k, v] of Object.entries(r)) {
      const key = normalizeKey(k);
      if (v === null || v === undefined) {
        row[key] = null;
      } else if (v instanceof Date) {
        row[key] = v.toISOString().slice(0, 10); // YYYY-MM-DD
      } else {
        row[key] = String(v).trim() || null;
      }
    }
    return row;
  });

  return { sheets, rows };}
