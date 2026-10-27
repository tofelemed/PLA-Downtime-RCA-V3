import {
  DecisionLine,
  Reconciliation,
  SliceReconciliation,
  WorkflowIssue,
} from './reconciliation.types';

/** Slice flags of the declared engine (spec §4.4) that refuse a submission. */
const LOSS_MISSING = 'declared_loss_missing';
const IDENTITY_MISMATCH = 'declared_identity_mismatch';

function slice(code: string, message: string, sliceId: string): WorkflowIssue {
  return { code, message, sliceId };
}

function hasToleranceLine(
  lines: readonly DecisionLine[],
  sliceId: string,
): boolean {
  return lines.some(
    (l) =>
      l.action === 'tolerance' &&
      l.sliceId === sliceId &&
      l.quantity !== null &&
      !l.quantity.isZero(),
  );
}

function sliceIssue(
  found: SliceReconciliation,
  lines: readonly DecisionLine[],
): WorkflowIssue | null {
  if (found.flags.includes(LOSS_MISSING)) {
    return slice(
      'DECLARED_LOSS_MISSING',
      'OT has declared no production loss for this period',
      found.sliceId,
    );
  }
  if (
    found.flags.includes(IDENTITY_MISMATCH) &&
    !hasToleranceLine(lines, found.sliceId)
  ) {
    return slice(
      'DECLARED_IDENTITY_MISMATCH',
      'the declared planned, actual and shortfall do not add up: have OT revise the event, or book the difference as a tolerance adjustment',
      found.sliceId,
    );
  }
  return null;
}

/**
 * Declared-mode content gates of a submission (spec §4.4): the period needs its production loss event
 * (`DECLARED_LOSS_MISSING`) and the event's figures must add up (`DECLARED_IDENTITY_MISMATCH`) unless the
 * difference is booked as a tolerance adjustment line (evaluated after the tolerance adjustments).
 * A slice without the event raises only the first.
 */
export function declaredIssues(
  reconciliation: Reconciliation,
  lines: readonly DecisionLine[],
): WorkflowIssue[] {
  return reconciliation.slices
    .map((s) => sliceIssue(s, lines))
    .filter((found): found is WorkflowIssue => found !== null);
}
