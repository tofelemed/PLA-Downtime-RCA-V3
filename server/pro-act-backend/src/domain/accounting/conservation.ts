import { Dec, formatDec, ZERO } from '../actuals/decimal';
import {
  LedgerTotals,
  LossLineDraft,
  Segment,
  SIGNED_KINDS,
  ValidationIssue,
} from './accounting.types';
import { sumOf } from './claims';

/** Quantity as it is stored (numeric(24,8)): conservation is checked on what the reader will see. */
function stored(line: LossLineDraft): Dec {
  return new Dec(formatDec(line.quantity));
}

/** ACC05: the shares of every segment's causes add up to exactly 1. */
export function checkShares(
  sliceId: string,
  segments: readonly Segment[],
): ValidationIssue[] {
  return segments.flatMap((segment) =>
    [segment.stops, segment.microStops]
      .filter((causes) => causes.length > 0)
      .filter((causes) => !sumOf(causes.map((c) => c.share)).eq(1))
      .map(() => ({
        code: 'SHARES_NOT_CONSERVED',
        message: `causes of the segment at ${segment.start.toISOString()} do not share exactly 1`,
        sliceId,
      })),
  );
}

/** Capacity identity on the stored lines: Σ exclusion + A + P + Q + good − gain + residual = capacity. */
function checkCapacity(
  totals: LedgerTotals,
  lines: readonly LossLineDraft[],
  epsilon: Dec,
): ValidationIssue[] {
  if (!totals.capacity || totals.good === null) return [];
  const mine = lines.filter(
    (l) => l.ledger === 'capacity' && l.sliceId === totals.sliceId,
  );
  const signed = mine.map((l) =>
    l.kind === 'gain' ? stored(l).neg() : stored(l),
  );
  const explained = sumOf(signed).plus(totals.good);
  if (explained.minus(totals.capacity).abs().lte(epsilon)) return [];
  return [
    {
      code: 'CAPACITY_NOT_CONSERVED',
      message: `capacity lines + good = ${formatDec(explained)} ≠ capacity ${formatDec(totals.capacity)}`,
      sliceId: totals.sliceId,
    },
  ];
}

/** Plan identity: Σ attributed + residual = gap, and attribution beyond the gap is always flagged. */
function checkPlan(totals: LedgerTotals, epsilon: Dec): ValidationIssue[] {
  if (
    totals.gap === null ||
    totals.residual === null ||
    totals.attributed === null
  )
    return [];
  const issues: ValidationIssue[] = [];
  if (
    !totals.attributed
      .plus(totals.residual)
      .minus(totals.gap)
      .abs()
      .lte(epsilon)
  ) {
    issues.push({
      code: 'PLAN_NOT_CONSERVED',
      message: 'attributed + residual ≠ gap',
      sliceId: totals.sliceId,
    });
  }
  const beyond = totals.attributed.gt(totals.gap.plus(epsilon));
  const flagged = [
    'over_accounted',
    'overproduction',
    'conflict',
    'bridge_required',
  ].some((f) => totals.flags.includes(f));
  if (beyond && !flagged) {
    issues.push({
      code: 'PLAN_UNFLAGGED_EXCESS',
      message: 'plan lines exceed the gap without a flag',
      sliceId: totals.sliceId,
    });
  }
  return issues;
}

/** No negative loss except the signed kinds; automatic keys are unique within the run. */
function checkLines(lines: readonly LossLineDraft[]): ValidationIssue[] {
  const issues: ValidationIssue[] = lines
    .filter((l) => !SIGNED_KINDS.has(l.kind) && l.quantity.lt(ZERO))
    .map((l) => ({
      code: 'NEGATIVE_LOSS',
      message: `${l.ledger} ${l.kind} line is negative`,
      sliceId: l.sliceId,
    }));
  const keys = new Set<string>();
  for (const line of lines) {
    if (keys.has(line.autoKey)) {
      issues.push({
        code: 'DUPLICATE_AUTO_KEY',
        message: line.autoKey,
        sliceId: line.sliceId,
      });
    }
    keys.add(line.autoKey);
  }
  return issues;
}

/** Conservation checks of plan 2.5 step 5, run before the draft pointer may switch to a new run. */
export function checkConservation(
  lines: readonly LossLineDraft[],
  totals: readonly LedgerTotals[],
  epsilon: Dec,
): ValidationIssue[] {
  return [
    ...checkLines(lines),
    ...totals.flatMap((t) =>
      t.ledger === 'capacity'
        ? checkCapacity(t, lines, epsilon)
        : checkPlan(t, epsilon),
    ),
  ];
}
