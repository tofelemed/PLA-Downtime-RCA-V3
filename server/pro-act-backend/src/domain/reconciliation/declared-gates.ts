import {
  DecisionLine,
  Reconciliation,
  SliceReconciliation,
  WorkflowIssue,
} from './reconciliation.types';

/** Slice flags of the declared engine (spec §4.4) that refuse a submission. */
const LOSS_MISSING = 'declared_loss_missing';
const IDENTITY_MISMATCH = 'declared_identity_mismatch';
const DUPLICATE = 'duplicate_declared_loss';

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

function sliceIssues(
  found: SliceReconciliation,
  lines: readonly DecisionLine[],
): WorkflowIssue[] {
  if (found.flags.includes(LOSS_MISSING)) {
    return [
      slice(
        'DECLARED_LOSS_MISSING',
        'OT has declared no production loss for this period',
        found.sliceId,
      ),
    ];
  }
  const issues: WorkflowIssue[] = [];
  if (found.flags.includes(DUPLICATE)) {
    issues.push(
      slice(
        'DECLARED_DUPLICATE',
        'more than one production loss event declares this period: retract or correct the duplicate, then recalculate',
        found.sliceId,
      ),
    );
  }
  if (
    found.flags.includes(IDENTITY_MISMATCH) &&
    !hasToleranceLine(lines, found.sliceId)
  ) {
    issues.push(
      slice(
        'DECLARED_IDENTITY_MISMATCH',
        'the declared planned, actual and shortfall do not add up: have OT revise the event, or book the difference as a tolerance adjustment',
        found.sliceId,
      ),
    );
  }
  return issues;
}

/** A declared period with no slice, or whose run has no slice totals, has no figures to review. */
export const NO_DECLARED_FIGURES: WorkflowIssue = {
  code: 'DECLARED_LOSS_MISSING',
  message: 'No declared production loss figures for this period',
  sliceId: null,
};

/** True when the period has no active slice or the run's reconciliation has no slice. */
export function declaredFiguresMissing(
  reconciliation: Reconciliation,
  activeSlices: number,
): boolean {
  return activeSlices === 0 || reconciliation.slices.length === 0;
}

/**
 * Declared-mode content gates of a submission (spec §4.4): the period needs its production loss event
 * (`DECLARED_LOSS_MISSING`), exactly one (`DECLARED_DUPLICATE` while several declare it) and the event's
 * figures must add up (`DECLARED_IDENTITY_MISMATCH`) unless the
 * difference is booked as a tolerance adjustment line (evaluated after the tolerance adjustments).
 * A slice without the event raises only the first; a period without any slice or slice totals raises
 * the period-level `DECLARED_LOSS_MISSING` (`activeSlices` = the period's active slices; default: the
 * reconciliation's slices).
 */
export function declaredIssues(
  reconciliation: Reconciliation,
  lines: readonly DecisionLine[],
  activeSlices: number = reconciliation.slices.length,
): WorkflowIssue[] {
  if (declaredFiguresMissing(reconciliation, activeSlices)) {
    return [NO_DECLARED_FIGURES];
  }
  return reconciliation.slices.flatMap((s) => sliceIssues(s, lines));
}
