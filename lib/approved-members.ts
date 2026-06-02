/**
 * Approved Operations team members.
 *
 * HOW TO ADD A MEMBER:
 *   1. Add their @orca-ai.io email to APPROVED_EMAILS below.
 *   2. Add a matching entry in app/data/mock.ts → teamMembers array.
 *   3. Redeploy.
 *
 * HOW TO REMOVE ACCESS:
 *   1. Remove their email from APPROVED_EMAILS.
 *   2. Redeploy.  Their Supabase Auth account stays (they just can't pass middleware).
 *
 * FUTURE: Move this list to the team_members Supabase table and check via RLS.
 *         That allows admin UI management without redeployment.
 */
export const APPROVED_EMAILS: readonly string[] = [
  'yotam.keret@orca-ai.io',
  'dan.cohen@orca-ai.io',
  'amit.levy@orca-ai.io',
  'noa.shaked@orca-ai.io',
  'eliav.mizrahi@orca-ai.io',
  'liora.ben-david@orca-ai.io',
  'omer.shapiro@orca-ai.io',
];

export function isApproved(email: string | null | undefined): boolean {
  return APPROVED_EMAILS.includes((email ?? '').toLowerCase());
}
