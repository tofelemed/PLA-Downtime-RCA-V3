import { LossLineDraft, RateVersion, Segment } from './accounting.types';
import { PRODUCT_RUN_SHARE } from './claim-pooling';
import { RateBasis, rateOf } from './time-lines';

/** UX D-2: the rate value a rate-based line was computed with (after the plan's scaling to target). */
export interface AppliedRate {
  value: string;
  timebase: string;
}

/**
 * The rate each rate version had in the segments a ledger computed with (the plan ledger's segments carry
 * the planning rate scaled to the target). A version seen with two values maps to null (not one rate).
 */
function ratesById(
  segments: readonly Segment[],
  basis: RateBasis,
): Map<string, RateVersion | null> {
  const byId = new Map<string, RateVersion | null>();
  for (const segment of segments) {
    const rate = rateOf(segment, basis);
    if (!rate) continue;
    const known = byId.get(rate.id);
    if (known === undefined) byId.set(rate.id, rate);
    else if (known && known.rate !== rate.rate) byId.set(rate.id, null);
  }
  return byId;
}

function appliedRateOf(
  line: LossLineDraft,
  rates: ReadonlyMap<string, RateVersion | null>,
): AppliedRate | null {
  const rateBased =
    line.basis === 'sustained_rate' || line.basis === 'planning_rate';
  // a product-run share was computed in several slices, each with its own rate: no single applied rate
  if (
    !rateBased ||
    !line.rateVersionId ||
    line.flags.includes(PRODUCT_RUN_SHARE)
  )
    return null;
  const rate = rates.get(line.rateVersionId);
  return rate ? { value: rate.rate, timebase: rate.timebase } : null;
}

/**
 * Records on every rate-based line the rate value its quantity was computed with — taken from the same
 * segments the ledger used, so no quantity is recomputed or changed.
 */
export function withAppliedRates(
  lines: readonly LossLineDraft[],
  segments: readonly Segment[],
  basis: RateBasis,
): LossLineDraft[] {
  const rates = ratesById(segments, basis);
  return lines.map((line) => {
    const appliedRate = appliedRateOf(line, rates);
    return appliedRate ? { ...line, appliedRate } : line;
  });
}
