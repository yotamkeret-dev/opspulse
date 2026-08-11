import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isApproved } from '@/lib/approved-members';

// Next.js 16 renamed "middleware" to "proxy" — same API, different export name.
export async function proxy(request: NextRequest) {
  // Public paths that do not need auth
  const { pathname } = request.nextUrl;
  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/access-denied');

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll()             { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() validates the token server-side — never trusts a stale cookie.
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    if (isPublic) return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Authenticated but not on the approved Operations team list
  if (!isApproved(user.email)) {
    if (pathname === '/access-denied') return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = '/access-denied';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
