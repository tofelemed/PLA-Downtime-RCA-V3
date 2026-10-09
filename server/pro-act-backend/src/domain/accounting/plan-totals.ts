import { Dec, ZERO } from '../actuals/decimal';

export interface PlanTotalsInput {
  target: Dec;
  /** good of the slice; null = actuals unknown */
  actual: Dec | null;
  /** Σ active plan lines (attributed plan loss) */
  attributed: Dec;
  epsilon: Dec;
}

export interface PlanTotals {
  gap: Dec | null;
  attributed: Dec;
  residual: Dec | null;
  overproduction: Dec | null;
  overAccounted: Dec | null;
  flags: string[];
}

/**
 * Plan identity of ACC01: `target − good = attributed + residual`. The residual is signed and never
 * clamped (T15 unaccounted 10, T16 −10 over-accounted). Above-plan output is overproduction, and
 * attributed plan loss on an overproducing slice is a `conflict` (T17) — the negative residual is not a
 * loss and is never reported as downtime. Tolerance is the policy epsilon (D06: zero, 1e-6).
 */
export function planTotals(input: PlanTotalsInput): PlanTotals {
  const { target, actual, attributed, epsilon } = input;
  if (actual === null) {
    return {
      gap: null,
      attributed,
      residual: null,
      overproduction: null,
      overAccounted: null,
      flags: ['actuals_missing'],
    };
  }
  const gap = target.minus(actual);
  const residual = gap.minus(attributed);
  const overproducing = gap.lt(epsilon.neg());
  const flags: string[] = [];
  if (residual.gt(epsilon)) flags.push('unaccounted');
  if (overproducing) flags.push('overproduction');
  if (overproducing && attributed.gt(epsilon)) flags.push('conflict');
  const overAccounted =
    !overproducing && residual.lt(epsilon.neg()) ? residual.neg() : ZERO;
  if (overAccounted.gt(ZERO)) flags.push('over_accounted');
  return {
    gap,
    attributed,
    residual,
    overproduction: overproducing ? gap.neg() : ZERO,
    overAccounted,
    flags,
  };
}
