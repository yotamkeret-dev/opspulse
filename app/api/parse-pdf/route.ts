import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs'; // never run on edge — pdf-parse requires Node.js APIs

// Dynamic import inside the handler avoids canvas polyfill errors at build time
// (pdf-parse loads pdfjs which references DOMMatrix/ImageData in some environments).

/**
 * POST /api/parse-pdf
 * Receives a multipart PDF file, extracts text using pdf-parse,
 * and returns structured rows for Oracle PO documents.
 *
 * Text-based PDFs only. Scanned PDFs require OCR (future phase).
 */
export async function POST(request: NextRequest) {
  try {
    if (typeof globalThis.DOMMatrix === 'undefined') {
  class DOMMatrixPolyfill {
    constructor() {}
  }
  ;(globalThis as any).DOMMatrix = DOMMatrixPolyfill
}
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const bytes = await (file as File).arrayBuffer();
    const buffer = Buffer.from(bytes);
    // Dynamic import keeps pdfjs out of module evaluation and avoids canvas polyfill errors
    // eslint-disable-next-line @typescript-eslint/no-require-imports
   const { PDFParse } = require('pdf-parse');

const parser = new PDFParse({ data: buffer });
const parsed = await parser.getText();
await parser.destroy();
    const rows = extractOraclePORows(parsed.text);

    return NextResponse.json({
      rows,
     pageCount: parsed.total ?? 0,
      charCount: parsed.text.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── Oracle PO text extraction ────────────────────────────────────────────

/**
 * Splits multi-PO PDFs at "Purchase Order" header boundaries,
 * then extracts fields from each section.
 */
function extractOraclePORows(text: string): Record<string, string | null>[] {
  // Split on PO boundaries — common Oracle header patterns
  const boundaries = /(?=(?:PURCHASE\s+ORDER|P\.?O\.?\s*(?:NUMBER|NO\b|#)))/gi;
  const sections = text.split(boundaries).filter(s => s.trim().length > 20);

  const results = sections.map(extractSinglePO).filter(r => Object.keys(r).length > 2);

  // If nothing useful was found, return the whole text as one raw section
  if (results.length === 0) {
    return [{ RAW_TEXT: text.slice(0, 2000) }];
  }

  return results;
}

function extractSinglePO(text: string): Record<string, string | null> {
  const row: Record<string, string | null> = {};

  // Key-value pairs — Oracle PO common field patterns
  const kvPatterns: [string, RegExp][] = [
    ['PO_NUMBER',      /(?:P\.?O\.?\s*(?:NUMBER|NO\.?|#|:)\s*)([A-Z0-9\-\/]+)/i],
    ['SUPPLIER',       /(?:(?:SUPPLIER|VENDOR|VENDOR\s*NAME|BILL\s*TO)\s*[:\-]?\s*)([^\n\r]{2,60})/i],
    ['PO_DATE',        /(?:P\.?O\.?\s*DATE|ORDER\s*DATE|DATE\s*[:\-])\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/i],
    ['CURRENCY',       /(?:CURRENCY\s*[:\-]\s*)([A-Z]{3})/i],
    ['PAYMENT_TERMS',  /(?:PAYMENT\s*TERMS?\s*[:\-]\s*)([^\n\r]{2,40})/i],
    ['TAX_ID',         /(?:TAX\s*(?:ID|NUMBER|REG\.?)\s*[:\-]\s*)([^\n\r]{2,30})/i],
    ['REQUESTER',      /(?:(?:REQUESTER|BUYER|PREPARED\s*BY|ORDERED\s*BY|CONTACT)\s*[:\-]\s*)([^\n\r]{2,50})/i],
    ['RECEIPT_DATE',   /(?:(?:RECEIPT|DELIVERY|REQUIRED|NEED)\s*DATE\s*[:\-]\s*)(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i],
    ['STATUS',         /(?:(?:PO\s*)?STATUS\s*[:\-]\s*)([A-Za-z][A-Za-z\s]{1,20})/i],
    ['TOTAL',          /(?:(?:GRAND\s*)?TOTAL\s*[:\-]?\s*)[\$€£₪]?\s*([\d,]+\.?\d{0,2})/i],
    ['TAX_AMOUNT',     /(?:TAX\s*(?:AMOUNT)?\s*[:\-]?\s*)[\$€£₪]?\s*([\d,]+\.?\d{0,2})/i],
  ];

  for (const [key, pattern] of kvPatterns) {
    const m = text.match(pattern);
    if (m?.[1]) row[key] = m[1].trim();
  }

  // Extract line items from table-like structure
  const lineItems = extractLineItems(text);
  if (lineItems.length > 0) {
    row['LINE_ITEMS']  = JSON.stringify(lineItems);
    row['ITEM_COUNT']  = String(lineItems.length);
    // Sum line amounts as a fallback if TOTAL not found
    if (!row['TOTAL']) {
      const sum = lineItems.reduce((acc, item) => {
        const amt = parseFloat((item.amount ?? '0').replace(/[,]/g, ''));
        return acc + (isNaN(amt) ? 0 : amt);
      }, 0);
      if (sum > 0) row['TOTAL'] = sum.toFixed(2);
    }
  }

  return row;
}

function extractLineItems(text: string): Array<Record<string, string>> {
  const items: Array<Record<string, string>> = [];

  // Pattern: line number, description, optional MPN, qty, unit price, amount
  // e.g. "1  Component XYZ  ABC-123  5  $2,400.00  $12,000.00"
  const linePattern =
    /^\s*(\d{1,3})\s+([A-Za-z][\w\s\-\/\.]{2,50?}?)\s+([\d,]+(?:\.\d+)?)\s+[\$€£₪]?([\d,]+(?:\.\d+)?)\s+[\$€£₪]?([\d,]+(?:\.\d+)?)/gm;

  let m: RegExpExecArray | null;
  while ((m = linePattern.exec(text)) !== null) {
    items.push({
      item:        m[1],
      description: m[2].trim(),
      quantity:    m[3],
      unitPrice:   m[4],
      amount:      m[5],
    });
  }

  return items;
  }