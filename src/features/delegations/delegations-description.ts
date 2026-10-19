/** What a delegation does; the SuperAdmin exception is told to SuperAdmin only (QA re-test 2026-10-19). */
export function delegationsDescription(isSuperAdmin: boolean): string {
  const base = 'Hand an approval role to a delegate for an absence (at most 90 days). The delegate approves like the role holder and must stay independent of the work they approve.';
  return isSuperAdmin ? `${base} As SuperAdmin you may complete every stage personally.` : base;
}
