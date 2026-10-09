import { Dec } from '../actuals/decimal';
import { PeriodAccounting, PeriodAccountingInput } from './accounting.types';
import { capacityLedger } from './capacity-ledger';
import { checkConservation, checkShares } from './conservation';
import { planLedger } from './plan-ledger';
import { segmentSlice } from './segmentation';

/** Bumped whenever a rule of the accounting engine changes (recorded on every calculation run). */
export const ACCOUNTING_ENGINE_VERSION = '2.5.0';

/**
 * The loss-accounting engine of plan 2.5 (pure, decimal): per slice, atomic segments, the capacity
 * ledger and the plan ledger, then the conservation checks. Identical inputs give identical lines,
 * quantities and automatic keys; a non-empty `issues` list means the run must fail validation.
 */
export function computePeriodAccounting(
  input: PeriodAccountingInput,
): PeriodAccounting {
  const result: PeriodAccounting = {
    lines: [],
    totals: [],
    issues: [],
    segmentCount: 0,
  };
  for (const slice of input.slices) {
    const segments = segmentSlice(input, slice);
    result.segmentCount += segments.length;
    result.issues.push(...checkShares(slice.sliceId, segments));
    for (const ledger of [
      capacityLedger(input, slice, segments),
      planLedger(input, slice, segments),
    ]) {
      result.lines.push(...ledger.lines);
      result.totals.push(ledger.totals);
      result.issues.push(...ledger.issues);
    }
  }
  result.issues.push(
    ...checkConservation(
      result.lines,
      result.totals,
      new Dec(input.policy.epsilon),
    ),
  );
  return result;
}
