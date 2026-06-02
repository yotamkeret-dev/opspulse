import { createBrowserClient } from '@supabase/ssr';

// Browser-side Supabase client — safe to call in 'use client' components.
// Creates a new instance each call; @supabase/ssr handles cookie management internally.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
