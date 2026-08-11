import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  let ssoCode: string | undefined;
  try {
    const body = await request.json();
    ssoCode = typeof body?.sso_code === 'string' ? body.sso_code.trim() : undefined;
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  if (!ssoCode) {
    return NextResponse.json({ error: 'missing_sso_code' }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  return NextResponse.json({ url: `${origin}/auth/callback?code=${encodeURIComponent(ssoCode)}` });
}
