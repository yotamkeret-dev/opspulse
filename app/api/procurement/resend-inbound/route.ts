import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// ─── Webhook signature verification (Standard Webhooks spec) ─────────────────
// Resend signs with HMAC-SHA256. Secret is whsec_<base64>.
// Signed content: "{webhook-id}.{webhook-timestamp}.{rawBody}"

function verifySignature(
  rawBody: string,
  headers: { id: string; timestamp: string; signature: string },
  secret: string,
): boolean {
  try {
    const key    = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
    const signed = `${headers.id}.${headers.timestamp}.${rawBody}`;
    const mac    = crypto.createHmac('sha256', key).update(signed).digest('base64');
    // webhook-signature may contain multiple "v1,<base64>" tokens separated by spaces
    return headers.signature
      .split(' ')
      .some(part => {
        const b64 = part.startsWith('v1,') ? part.slice(3) : part;
        return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(b64));
      });
  } catch {
    return false;
  }
}

// ─── Resend inbound payload types ─────────────────────────────────────────────

interface ResendAttachmentMeta {
  id:                  string;
  filename:            string | null;
  content_type:        string;
  content_disposition: string | null;
  content_id:          string | null;
}

interface EmailReceivedData {
  email_id:     string;
  created_at:   string;
  from:         string;
  to:           string[];
  received_for: string[];
  message_id:   string;
  subject:      string;
  attachments:  ResendAttachmentMeta[];
}

// ─── Attachment download ───────────────────────────────────────────────────────
// Two steps: fetch signed URL from Resend API, then download from that URL.

async function downloadAttachmentBytes(emailId: string, attachmentId: string): Promise<Uint8Array<ArrayBuffer>> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not set');

  const metaRes = await fetch(
    `https://api.resend.com/emails/${emailId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (!metaRes.ok) {
    const body = await metaRes.text();
    throw new Error(`Resend attachments.get failed (${metaRes.status}): ${body}`);
  }

  const { download_url } = await metaRes.json() as { download_url: string };

  const fileRes = await fetch(download_url);
  if (!fileRes.ok) {
    throw new Error(`Attachment download failed (${fileRes.status})`);
  }

  const ab: ArrayBuffer = await fileRes.arrayBuffer();
  return new Uint8Array(ab);
}

// ─── POST /api/procurement/resend-inbound ─────────────────────────────────────
// Receives Resend inbound email.received webhook events.
//
// Required env vars:
//   RESEND_WEBHOOK_SECRET     — whsec_... signing secret from Resend dashboard
//   RESEND_API_KEY            — Resend API key (to fetch attachment download URL)
//   AUTO_IMPORT_COMPANY_ID    — tenant UUID passed to auto-import
//   PROCUREMENT_EMAIL_ADDRESS — inbox address; emails for other recipients are skipped
//   CRON_SECRET               — already set; reused as Bearer token for auto-import

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'RESEND_WEBHOOK_SECRET not set' }, { status: 500 });
  }

  // Read raw body before any parsing — must match the bytes Resend signed
  const rawBody = await request.text();

  // ── Verify signature ──
  const webhookId        = request.headers.get('webhook-id')        ?? '';
  const webhookTimestamp = request.headers.get('webhook-timestamp')  ?? '';
  const webhookSignature = request.headers.get('webhook-signature')  ?? '';

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return NextResponse.json({ error: 'missing_signature_headers' }, { status: 400 });
  }

  if (!verifySignature(rawBody, { id: webhookId, timestamp: webhookTimestamp, signature: webhookSignature }, webhookSecret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  // ── Parse event ──
  let event: { type: string; data: EmailReceivedData };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Silently accept non-received events so Resend does not retry them
  if (event.type !== 'email.received') {
    return NextResponse.json({ skipped: true, reason: 'not_email_received' });
  }

  const data = event.data;

  // ── Validate recipient ──
  const procEmail = process.env.PROCUREMENT_EMAIL_ADDRESS;
  if (procEmail) {
    const addressed = (data.received_for ?? []).some(
      addr => addr.toLowerCase() === procEmail.toLowerCase(),
    );
    if (!addressed) {
      return NextResponse.json({ skipped: true, reason: 'wrong_recipient' });
    }
  }

  // ── Find first Excel attachment ──
  const excelMeta = (data.attachments ?? []).find(
    a => a.filename && /\.(xlsx|xls)$/i.test(a.filename),
  );
  if (!excelMeta) {
    return NextResponse.json({ skipped: true, reason: 'no_excel_attachment' });
  }

  // ── Download attachment bytes ──
  let attachmentBytes: Uint8Array<ArrayBuffer>;
  try {
    attachmentBytes = await downloadAttachmentBytes(data.email_id, excelMeta.id);
  } catch (err) {
    return NextResponse.json({ error: 'attachment_download_failed', detail: String(err) }, { status: 502 });
  }

  // ── Check required config ──
  const companyId = process.env.AUTO_IMPORT_COMPANY_ID;
  if (!companyId) {
    return NextResponse.json({ error: 'AUTO_IMPORT_COMPANY_ID not set' }, { status: 500 });
  }

  // ── Forward to existing auto-import route ──
  // source_id = data.email_id — Resend's stable inbound ID, matched by existing dedup
  const autoImportUrl = new URL('/api/procurement/auto-import', request.url).href;
  const formData      = new FormData();
  formData.append('file',         new File([attachmentBytes], excelMeta.filename!, { type: excelMeta.content_type }));
  formData.append('company_id',   companyId);
  formData.append('source_id',    data.email_id);
  formData.append('caller_email', 'resend-auto-import');

  const importRes  = await fetch(autoImportUrl, {
    method:  'POST',
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    body:    formData,
  });

  const importBody = await importRes.json();
  return NextResponse.json({ email_id: data.email_id, ...importBody }, { status: importRes.status });
}
