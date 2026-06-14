import type { RawRow } from '../types';

/**
 * Client-side PDF parser.
 * Sends the file to /api/parse-pdf (server-side pdf-parse), receives structured rows.
 * Text-based PDFs only — no OCR support in this version.
 */
export async function parsePDF(file: File): Promise<RawRow[]> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/parse-pdf', {
    method: 'POST',
    body:   formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`PDF parsing failed: ${text}`);
  }

  const json = await res.json();
  return (json.rows ?? []) as RawRow[];
}
