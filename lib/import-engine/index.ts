/**
 * Import Engine — public API
 *
 * Usage:
 *   import { parseFile, buildPreview } from '@/lib/import-engine';
 *
 * Completely schema-agnostic. Knows nothing about ProcurementRecord,
 * Supabase tables, or React state. All that lives in the calling component.
 */

export { parseCSV }               from './parsers/csv';
export { parseExcel }             from './parsers/excel';
export { parsePDF }               from './parsers/pdf';
export { detectColumnMappings, columnMatchesToMap } from './mappers/base-mapper';
export { ORACLE_PO_RULES, mapOraclePORow, matchEmployee, ORACLE_PO_TEMPLATE_ID } from './mappers/oracle-po';
export { fetchTemplates, saveTemplate, deleteTemplate, ORACLE_PO_DEFAULT_TEMPLATE } from './templates';
export type {
  RawRow,
  RawImportMeta,
  MappedRecord,
  FieldMappingRule,
  FieldIssue,
  ColumnMatch,
  ConfidenceLevel,
  MappingTemplate,
  SavedFieldMapping,
  EmployeeMatch,
  ParsedFile,
} from './types';

import type { RawRow, ParsedFile } from './types';
import { parseCSV }    from './parsers/csv';
import { parseExcel }  from './parsers/excel';
import { parsePDF }    from './parsers/pdf';

/**
 * One-stop parser: detects format by extension, returns rows + metadata.
 * Throws if the format is unsupported.
 */
export async function parseFile(file: File, sheetName?: string): Promise<ParsedFile> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'csv') {
    const text = await file.text();
    return {
      rows:       parseCSV(text),
      detectedAt: new Date().toISOString(),
      sourceType: 'csv',
    };
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer();
    const { sheets, rows } = await parseExcel(buffer, sheetName);
    return {
      rows,
      sheets,
      detectedAt: new Date().toISOString(),
      sourceType: 'excel',
    };
  }

  if (ext === 'pdf') {
    const rows = await parsePDF(file);
    return {
      rows,
      detectedAt: new Date().toISOString(),
      sourceType: 'pdf',
    };
  }

  throw new Error(
    `Unsupported format ".${ext}". Please upload a PDF, Excel (.xlsx), or CSV file.`
  );
}

/** Extract unique column headers from a set of rows. */
export function getHeaders(rows: RawRow[]): string[] {
  const keys = new Set<string>();
  for (const row of rows) Object.keys(row).forEach(k => keys.add(k));
  return [...keys];
}
