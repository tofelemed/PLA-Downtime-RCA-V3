export type ApprovalConflict = 'submitter' | 'line_author' | 'revision_opener';

export interface ApprovalParties {
  submittedBy: string | null;
  /** who opened the revision of an approved period (revise), null for a first revision */
  revisionOpenedBy: string | null;
  /** authors of the lines in the reviewed line set (null = written by the system) */
  lineAuthors: ReadonlyArray<string | null>;
}

/**
 * D06 "no self-approval", RC-01: the approver must be independent of the reviewed content — not its
 * submitter, not an author of any reconciliation line in it, and not whoever reopened an approved period.
 * Returns the first conflict, or null when the approver is independent.
 */
export function approvalConflict(
  approver: string,
  parties: ApprovalParties,
): ApprovalConflict | null {
  if (parties.submittedBy === approver) return 'submitter';
  if (parties.lineAuthors.includes(approver)) return 'line_author';
  if (parties.revisionOpenedBy === approver) return 'revision_opener';
  return null;
}
