import { Dec, formatDec, ZERO } from '../actuals/decimal';
import { MEMO_KINDS } from '../accounting/accounting.types';
import { sumOf } from '../accounting/claims';
import {
  Candidate,
  DecisionLine,
  Reconciliation,
  SliceReconciliation,
  ToleranceRule,
  WorkflowIssue,
} from './reconciliation.types';

/** Kinds that explain an over-allocation instead of consuming the gap (§15.3). */
const EXPLAINING_KINDS = new Set(['bridge', 'gain']);

/** What a saved line adds to the slice's attributed loss (positive = consumes the budget). */
function contributionOf(
  line: DecisionLine,
  candidates: ReadonlyMap<string, Candidate>,
): Dec {
  // SME R9: a reversal is outside this period's balance — it neither consumes nor frees the budget
  if (line.kind && MEMO_KINDS.has(line.kind)) return ZERO;
  if (line.action === 'manual') return line.quantity ?? ZERO;
  const present = line.autoKey !== null && candidates.has(line.autoKey);
  if ((line.action === 'adjust' || line.action === 'replace') && present)
    return line.quantity ?? ZERO;
  return ZERO;
}

function consumes(line: DecisionLine, contribution: Dec): boolean {
  return contribution.gt(ZERO) && !EXPLAINING_KINDS.has(line.kind ?? '');
}

function sliceIssue(
  slice: SliceReconciliation,
  reconciliation: Reconciliation,
  lines: readonly DecisionLine[],
  context: { candidates: ReadonlyMap<string, Candidate>; epsilon: Dec },
): WorkflowIssue | null {
  if (slice.gap === null) return null;
  const budget = slice.gap.plus(slice.tolerance);
  const kept = reconciliation.candidates.filter(
    (c) =>
      c.sliceId === slice.sliceId &&
      (c.state === 'proposed' || c.state === 'accepted'),
  );
  const own = lines
    .map((line, index) => ({
      line,
      index,
      amount: contributionOf(line, context.candidates),
    }))
    .filter((entry) => entry.line.sliceId === slice.sliceId);
  let running = sumOf([
    ...kept.map((c) => c.effectiveQuantity),
    ...own.filter((e) => !consumes(e.line, e.amount)).map((e) => e.amount),
  ]);
  for (const entry of own.filter((e) => consumes(e.line, e.amount))) {
    if (running.plus(entry.amount).gt(budget.plus(context.epsilon))) {
      return {
        code: 'ALLOCATION_EXCEEDED',
        message: `line ${entry.index} allocates more than the remaining gap of the slice`,
        sliceId: slice.sliceId,
        line: entry.index,
        expectedRemainingAllocation: formatDec(budget.minus(running)),
      };
    }
    running = running.plus(entry.amount);
  }
  return null;
}

/**
 * Allocation budget of a draft save (§15.3): per slice, the candidates kept as they are, explaining lines
 * (bridge / gain) and reductions come first; then every line that adds loss is taken in order and the first
 * one that pushes Σ beyond `gap + tolerance` is reported with the allocation that was still available.
 * Saving reductions alone is always possible, so an over-accounted draft can be repaired step by step.
 */
export function allocationIssues(
  reconciliation: Reconciliation,
  lines: readonly DecisionLine[],
  context: { candidates: readonly Candidate[]; rule: ToleranceRule },
): WorkflowIssue[] {
  const candidates = new Map(context.candidates.map((c) => [c.autoKey, c]));
  return reconciliation.slices
    .map((slice) =>
      sliceIssue(slice, reconciliation, lines, {
        candidates,
        epsilon: context.rule.epsilon,
      }),
    )
    .filter((found): found is WorkflowIssue => found !== null);
}
