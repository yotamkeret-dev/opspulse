import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { isApproved } from '@/lib/approved-members';

// Handles:
//  1. Magic-link sign-in  (type=magiclink or no type)
//  2. Password reset flow (type=recovery) → redirects to /auth/reset-password
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const type = searchParams.get('type') ?? '';

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Password reset: send to the reset form (session is active, updateUser will work there)
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/reset-password`);
      }

      // Magic link: validate approved list before allowing in
      const { data: { user } } = await supabase.auth.getUser();
      if (!isApproved(user?.email)) {
        return NextResponse.redirect(`${origin}/access-denied`);
      }
      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
