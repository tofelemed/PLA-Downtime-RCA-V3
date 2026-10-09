import { formatDec } from '../actuals/decimal';
import {
  DecisionLine,
  Reconciliation,
  SliceReconciliation,
  ToleranceRule,
  WorkflowIssue,
} from './reconciliation.types';

function issue(
  code: string,
  message: string,
  sliceId: string | null,
  line?: number,
): WorkflowIssue {
  return line === undefined
    ? { code, message, sliceId }
    : { code, message, sliceId, line };
}

/** Plan-ledger gates of one slice (ACC10): actuals known, no conflict, no residual beyond tolerance. */
function sliceIssue(
  slice: SliceReconciliation,
  rule: ToleranceRule,
): WorkflowIssue | null {
  if (slice.target === null) return null;
  const { sliceId } = slice;
  if (slice.actual === null || slice.residual === null) {
    return issue('ACTUALS_INCOMPLETE', 'the slice has no actual', sliceId);
  }
  if (slice.flags.includes('conflict')) {
    return issue(
      'OVERPRODUCTION_CONFLICT',
      'the slice produced above plan but carries attributed plan loss',
      sliceId,
    );
  }
  const residual = slice.residual;
  if (residual.gt(rule.epsilon)) {
    return issue(
      'RESIDUAL_UNEXPLAINED',
      `residual ${formatDec(residual)} ${slice.uom ?? ''} beyond tolerance ${formatDec(slice.tolerance)}`.trim(),
      sliceId,
    );
  }
  if (slice.overAccounted && slice.overAccounted.gt(rule.epsilon)) {
    return issue(
      'OVER_ACCOUNTED',
      `attributed loss exceeds the gap by ${formatDec(slice.overAccounted)} beyond tolerance ${formatDec(slice.tolerance)}`,
      sliceId,
    );
  }
  return null;
}

function lineIssue(
  line: DecisionLine,
  flags: readonly string[],
  rule: ToleranceRule,
  index: number,
): WorkflowIssue | null {
  const at = (code: string, message: string) =>
    issue(code, message, line.sliceId, index);
  if (flags.length > 0) {
    const what = flags.includes('candidate_missing')
      ? 'no longer exists'
      : 'changed since it was saved';
    return at(
      'BASELINE_CHANGED',
      `the candidate of this decision ${what}; save the decision again`,
    );
  }
  if (line.missingCode) return at('MISSING_CODE', 'the line has no cause code');
  if (
    line.kind === 'unaccounted_classified' &&
    !rule.allowUnaccountedClassification
  ) {
    return at(
      'UNACCOUNTED_NOT_ALLOWED',
      'the tolerance policy does not allow an Unaccounted classification',
    );
  }
  return null;
}

function lineIssues(
  reconciliation: Reconciliation,
  lines: readonly DecisionLine[],
  rule: ToleranceRule,
): WorkflowIssue[] {
  return lines
    .map((line, index) =>
      lineIssue(line, reconciliation.lineFlags[index] ?? [], rule, index),
    )
    .filter((found): found is WorkflowIssue => found !== null);
}

/**
 * Content gates of submission (ACC10, T15/T16): per slice no unknown actual, no overproduction conflict,
 * no positive residual beyond tolerance (`RESIDUAL_UNEXPLAINED`) and no over-accounting beyond tolerance
 * (`OVER_ACCOUNTED`); per line no decision on a changed or vanished candidate, no missing code and no
 * Unaccounted classification unless the policy allows it. Evaluated after the tolerance adjustments.
 */
export function submissionIssues(
  reconciliation: Reconciliation,
  lines: readonly DecisionLine[],
  rule: ToleranceRule,
): WorkflowIssue[] {
  const slices = reconciliation.slices
    .map((slice) => sliceIssue(slice, rule))
    .filter((found): found is WorkflowIssue => found !== null);
  return [...slices, ...lineIssues(reconciliation, lines, rule)];
}
