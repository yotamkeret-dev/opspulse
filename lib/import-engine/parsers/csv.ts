import type { RawRow } from '../types';

/**
 * RFC 4180-compliant CSV parser.
 * Handles quoted fields, embedded commas, and escaped quotes.
 */
export function parseCSV(text: string): RawRow[] {
  const lines = text.split(/\r?\n/);
  const nonEmpty = lines.filter(l => l.trim().length > 0);
  if (nonEmpty.length < 2) return [];

  const headers = parseLine(nonEmpty[0]);

  return nonEmpty
    .slice(1)
    .map(line => {
      const values = parseLine(line);
      const row: RawRow = {};
      headers.forEach((h, i) => {
        const key = h.trim();
        if (key) row[key] = values[i]?.trim() || null;
      });
      return row;
    })
    .filter(row => Object.values(row).some(v => v !== null && v !== ''));
}

function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
