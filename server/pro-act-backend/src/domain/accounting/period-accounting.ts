import { Dec } from '../actuals/decimal';
import { PeriodAccounting, PeriodAccountingInput } from './accounting.types';
import { capacityLedger } from './capacity-ledger';
import {
  ClaimPool,
  ClaimRecorder,
  pooledClaims,
  productRuns,
} from './claim-pooling';
import { checkConservation, checkShares } from './conservation';
import { planLedger } from './plan-ledger';
import { segmentSlice } from './segmentation';

/** Bumped whenever a rule of the accounting engine changes (recorded on every calculation run). */
// 2.5.5: grade transitions (LA-08) and micro-stops per asset class (SME D6) together
// 2.5.6: oee_policy transitionAllowanceInPlan — a plan that deducts standard transition time has no allowance line
// 2.5.7: SME E3 disposition classes — quality lines name their class (events, lot dispositions)
// 2.5.8: SME E1 transition-standard key adds catalyst family and operating mode (most specific match wins)
// 2.6.0: SME E6 / LA-10 streams — a slice's capacity is its streams' share over the time they ran its product;
//        stream events hit only that stream, declared quantities are assigned once (no streams = 2.5.8)
export const ACCOUNTING_ENGINE_VERSION = '2.6.0';

function computeSlices(
  input: PeriodAccountingInput,
  pool?: ClaimPool,
): PeriodAccounting {
  const result: PeriodAccounting = {
    lines: [],
    totals: [],
    issues: [],
    segmentCount: 0,
  };
  for (const slice of input.slices) {
    const segments = segmentSlice(input, slice, true);
    result.segmentCount += segments.length;
    result.issues.push(...checkShares(slice.sliceId, segments));
    for (const ledger of [
      capacityLedger(input, slice, segments, pool),
      planLedger(input, slice, segments, pool),
    ]) {
      result.lines.push(...ledger.lines);
      result.totals.push(ledger.totals);
      result.issues.push(...ledger.issues);
    }
  }
  return result;
}

/**
 * The loss-accounting engine of plan 2.5 (pure, decimal): per slice, atomic segments, the capacity
 * ledger and the plan ledger, then the conservation checks. Identical inputs give identical lines,
 * quantities and automatic keys; a non-empty `issues` list means the run must fail validation.
 *
 * Sequential slices of one product cut only by plan periods (a product run, `productRuns`) share their
 * performance and quality causes: a first pass records each slice's component totals and claims, the
 * second allocates the run's pooled claims to its slices in proportion to their totals. A plan
 * boundary is an accounting cut, not a production event: the slices' actuals come from evidence
 * apportioned by time (D05), so a cause located in one plan slice is checked against the run's total,
 * never against an arbitrary part of it (`IMPOSSIBLE_CLAIM` only when the run cannot hold it).
 */
export function computePeriodAccounting(
  input: PeriodAccountingInput,
): PeriodAccounting {
  const runs = productRuns(input.slices);
  let pool: ClaimPool | undefined;
  if (runs.length > 0) {
    const recorder = new ClaimRecorder();
    computeSlices(input, recorder);
    pool = pooledClaims(runs, recorder, new Dec(input.policy.epsilon));
  }
  const result = computeSlices(input, pool);
  result.issues.push(
    ...checkConservation(
      result.lines,
      result.totals,
      new Dec(input.policy.epsilon),
    ),
  );
  return result;
}
