import { Dec, ZERO } from '../actuals/decimal';
import {
  Reconciliation,
  SliceReconciliation,
  ToleranceRule,
} from './reconciliation.types';

/**
 * Tolerance of a slice (ACC09, D06): `zero` → 0; `absolute` → the value in the slice unit; `percent` →
 * value % of the target, and only an absolute tolerance applies to a zero target, so a percent policy
 * gives 0 there. The epsilon is a comparison precision, never a tolerance.
 */
export function toleranceFor(rule: ToleranceRule, target: Dec | null): Dec {
  if (rule.mode === 'absolute') return rule.value;
  if (rule.mode === 'percent' && target !== null && target.gt(ZERO)) {
    return target.times(rule.value).div(100);
  }
  return ZERO;
}

export interface ToleranceAdjustment {
  sliceId: string;
  quantity: Dec;
}

function adjustmentOf(
  slice: SliceReconciliation,
  epsilon: Dec,
): ToleranceAdjustment | null {
  const residual = slice.unadjustedResidual;
  if (residual === null || slice.gap === null) return null;
  if (slice.gap.lt(epsilon.neg())) return null;
  const size = residual.abs();
  if (size.lte(epsilon) || size.gt(slice.tolerance)) return null;
  return { sliceId: slice.sliceId, quantity: residual };
}

/**
 * The labelled `tolerance_adjustment` lines submit writes (ACC09, T32): for every slice whose residual
 * before adjustments is non-zero (beyond epsilon) but within tolerance, one line with exactly that signed
 * residual, so the ledger closes explicitly — never a silent zero. Overproducing slices get none.
 */
export function toleranceAdjustments(
  reconciliation: Reconciliation,
  rule: ToleranceRule,
): ToleranceAdjustment[] {
  return reconciliation.slices
    .map((slice) => adjustmentOf(slice, rule.epsilon))
    .filter((found): found is ToleranceAdjustment => found !== null);
}
