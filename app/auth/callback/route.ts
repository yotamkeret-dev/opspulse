import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { isApproved } from '@/lib/approved-members';

// Handles the magic-link / OAuth callback redirect from Supabase.
// Supabase sends the user here after they click the email link.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (!isApproved(user?.email)) {
        return NextResponse.redirect(`${origin}/access-denied`);
      }

      return NextResponse.redirect(`${origin}/`);
    }
  }

  // Fallback: something went wrong
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
