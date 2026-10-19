/**
 * QA re-test N4: "SuperAdmin may approve their own …" is shown to SuperAdmin only; everyone else sees no
 * sentence about it (they cannot approve their own work). Returns the sentence with a leading space, or ''.
 */
export function selfApprovalNote(isSuperAdmin: boolean, noun: string): string {
  return isSuperAdmin ? ` As SuperAdmin you may approve your own ${noun}.` : '';
}
