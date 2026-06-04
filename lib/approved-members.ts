/**
 * Approved Operations team members.
 *
 * HOW TO ADD A MEMBER:
 *   1. Add their email to APPROVED_EMAILS below.
 *   2. Add a matching entry in app/data/mock.ts → teamMembers.
 *   3. Create a Supabase Auth user: run `node scripts/create-users.mjs` or add via Supabase Dashboard.
 *   4. Redeploy.
 *
 * HOW TO REMOVE ACCESS:
 *   1. Remove their email from APPROVED_EMAILS.
 *   2. Redeploy. Their Supabase Auth account stays; they hit /access-denied on next request.
 *   3. Optionally delete their Auth user in Supabase Dashboard → Authentication → Users.
 */
export const APPROVED_EMAILS: readonly string[] = [
  'yotam.keret@orca-ai.io',
  'rami@orca-ai.io',
  'amir.m@orca-ai.io',
  'yaron.y@orca-ai.io',
  'leon.gutnik@orca-ai.io',
  'zohar.b@orca-ai.io',
  'israel@orca-ai.io',
  'jacob@orca-ai.io',
  'tal.matza@orca-ai.io',
  'guy.hadad@orca-ai.io',
];

export function isApproved(email: string | null | undefined): boolean {
  return APPROVED_EMAILS.includes((email ?? '').toLowerCase());
}
