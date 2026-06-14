/**
 * Import Engine — shared types
 * Intentionally decoupled from any specific schema (ProcurementRecord, SupportLog, etc.)
 * so the same engine can be reused for future Oracle/ERP imports.
 */

// One raw parsed row — any column name, any value
export type RawRow = Record<string, string | number | null>;

// Metadata stored in raw_import column for traceability
export interface RawImportMeta {
  sourceFile:    string;
  sourceType:    'pdf' | 'excel' | 'csv';
  importedAt:    string;   // ISO timestamp
  importVersion: '1.0';
  extractedRows: RawRow[]; // original rows before field mapping
  templateId?:   string;
  templateName?: string;
}

// Result of mapping one raw row to a target schema's fields
export interface MappedRecord<T = Record<string, unknown>> {
  id:         string;
  data:       Partial<T>;
  rawData:    RawRow;
  status:     'ready' | 'needs_review';
  issues:     FieldIssue[];
  confidence: number;        // 0–1 overall confidence
  rawImport:  RawImportMeta; // pre-filled for the whole import session
}

export interface FieldIssue {
  field:  string;
  reason: string;
}

// A rule for mapping a source column to a target field
export interface FieldMappingRule {
  targetField:    string;
  label:          string;      // human-readable label for the preview UI
  sourcePatterns: string[];    // case-insensitive source column name patterns
  required:       boolean;
  transform?:     (raw: string) => unknown;
  defaultValue?:  unknown;
  aiHint?:        string;      // reserved for future AI-assisted recognition
}

// Confidence level for a column auto-match
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unmapped';

// How each detected source column maps to a target field
export interface ColumnMatch {
  sourceColumn: string;
  targetField:  string | null;
  confidence:   ConfidenceLevel;
}

// A named, reusable mapping template stored in Supabase import_templates
export interface MappingTemplate {
  id:           string;
  name:         string;
  description:  string;
  targetSchema: string;       // e.g. 'procurement' | 'inventory'
  fieldMappings: SavedFieldMapping[];
  createdBy?:   string;
  createdAt:    string;
}

// Serialisable version of a column mapping (no functions — stored as JSON)
export interface SavedFieldMapping {
  sourceColumn: string;
  targetField:  string | null;
}

// Employee match result
export interface EmployeeMatch {
  memberId?:   string;
  memberName?: string;
  confidence:  number;        // 0–1
  isAutomatic: boolean;       // false = needs user confirmation
}

// Result of parsing a file before any field mapping
export interface ParsedFile {
  rows:        RawRow[];
  sheets?:     string[];      // xlsx only — list of sheet names
  detectedAt:  string;
  sourceType:  'pdf' | 'excel' | 'csv';
}
