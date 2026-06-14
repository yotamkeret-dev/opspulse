import type { FieldMappingRule, ColumnMatch, ConfidenceLevel } from '../types';

/**
 * Fuzzy column matcher.
 * Compares source column headers against field mapping rule patterns
 * using token-overlap similarity.
 */
export function detectColumnMappings(
  headers: string[],
  rules: FieldMappingRule[]
): ColumnMatch[] {
  return headers.map(header => {
    const norm = normalise(header);
    let bestField: string | null = null;
    let bestScore = 0;

    for (const rule of rules) {
      for (const pattern of rule.sourcePatterns) {
        const score = similarity(norm, normalise(pattern));
        if (score > bestScore) {
          bestScore = score;
          bestField = rule.targetField;
        }
      }
    }

    const confidence: ConfidenceLevel =
      bestScore >= 0.85 ? 'high' :
      bestScore >= 0.60 ? 'medium' :
      bestScore >= 0.40 ? 'low' :
      'unmapped';

    return {
      sourceColumn: header,
      targetField:  bestScore >= 0.40 ? bestField : null,
      confidence,
    };
  });
}

/**
 * Build a column→field map from an array of ColumnMatch results.
 * null targetField means "skip this column".
 */
export function columnMatchesToMap(
  matches: ColumnMatch[]
): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const m of matches) {
    map[m.sourceColumn] = m.targetField;
  }
  return map;
}

// ─── helpers ──────────────────────────────────────────────────────────────

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function similarity(a: string, b: string): number {
  const aSet = new Set(a.split(' ').filter(Boolean));
  const bSet = new Set(b.split(' ').filter(Boolean));
  let intersection = 0;
  aSet.forEach(t => { if (bSet.has(t)) intersection++; });
  const union = new Set([...aSet, ...bSet]).size;
  return union === 0 ? 0 : intersection / union;
}
