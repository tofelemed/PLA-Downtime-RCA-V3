import { ApprovalParties, approvalConflict } from './separation-of-duties';

/** The parties a reconciliation decision is independent of, plus the bridge reviewer of the submission. */
export interface ReconciliationDecisionParties extends ApprovalParties {
  /** who reviewed the bridges of the decided submission (SME R8), null without a bridge review */
  bridgeReviewer: string | null;
}

/**
 * Item 1.3: a revision approved by its submitter, its opener, an author of one of its lines, or the person
 * who also gave its bridge second review — only a SuperAdmin may (D06, owner decision 2026-10-16).
 */
export function revisionSelfApproved(
  approvedBy: string | null,
  parties: ReconciliationDecisionParties,
): boolean {
  if (!approvedBy) return false;
  return (
    approvalConflict(approvedBy, parties) !== null ||
    parties.bridgeReviewer === approvedBy
  );
}

/** Workflow actions whose actor must be independent of the reviewed submission. */
export const INDEPENDENT_ACTIONS: ReadonlySet<string> = new Set([
  'approve',
  'reject',
  'bridge_review',
]);

/**
 * Whether one approval-history action was a self-decision, with the rule its command applies: a rejection
 * is independent of the submitter only; a bridge review of the submitter, opener and line authors; an
 * approval of those and of the bridge reviewer. Other actions are never decisions on one's own work.
 */
export function workflowActionSelfDecided(
  action: string,
  actor: string | null,
  parties: ReconciliationDecisionParties,
): boolean {
  if (!actor) return false;
  if (action === 'reject') return parties.submittedBy === actor;
  if (action === 'bridge_review')
    return approvalConflict(actor, parties) !== null;
  if (action === 'approve') return revisionSelfApproved(actor, parties);
  return false;
}
