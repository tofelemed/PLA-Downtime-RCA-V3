import { RateTimebase } from '../actuals/actuals.types';
import { Dec, formatDec, toDec } from '../actuals/decimal';
import { RateKind } from './profile.types';

/**
 * Capacity gap of one unit / product (plan 1.2, D-T1 / SME Q16): the approved rate kinds side by side,
 * nameplate (design reference) → demonstrated (proven achievable) → sustained (approved sustainable
 * capability, capacity ledger) → planning (time-specific planned rate, plan ledger). Each step's gap is
 * `upper − lower` exactly as stored; nothing is inferred for a missing kind, kinds are never added
 * together, and different units of measure or timebases are never converted (null with a reason).
 */
export const CAPACITY_STEPS = [
  ['nameplate', 'demonstrated'],
  ['demonstrated', 'sustained'],
  ['sustained', 'planning'],
] as const satisfies ReadonlyArray<readonly [RateKind, RateKind]>;

/** Utilisation ratios `numerator / denominator`. */
export const CAPACITY_RATIOS = [
  ['sustained', 'nameplate'],
  ['planning', 'sustained'],
] as const satisfies ReadonlyArray<readonly [RateKind, RateKind]>;

/** One approved rate as stored: decimal string per timebase, in the profile's quantity unit. */
export interface CapacityRate {
  rate: string;
  timebase: RateTimebase;
  uom: string | null;
}

/** Why a gap or ratio is null. */
export type CapacityGapReason =
  | 'not_set'
  | 'uom_mismatch'
  | 'timebase_mismatch'
  | 'zero_base';

export interface CapacityGapStep {
  upper: RateKind;
  lower: RateKind;
  /** `upper − lower` (negative when the lower kind is higher), decimal string */
  gap: string | null;
  /** `gap / upper`; null when the gap is null or the upper rate is zero */
  ratio: string | null;
  reason: Exclude<CapacityGapReason, 'zero_base'> | null;
}

export interface CapacityRatio {
  numerator: RateKind;
  denominator: RateKind;
  ratio: string | null;
  reason: CapacityGapReason | null;
}

export interface CapacityGaps {
  gaps: CapacityGapStep[];
  ratios: CapacityRatio[];
}

type Pair =
  | { a: Dec; b: Dec; reason: null }
  | { a: null; b: null; reason: Exclude<CapacityGapReason, 'zero_base'> };

/** Both rates as decimals when they are set and comparable (same unit of measure and timebase). */
function comparable(a?: CapacityRate, b?: CapacityRate): Pair {
  const da = toDec(a?.rate);
  const db = toDec(b?.rate);
  if (!a || !b || da === null || db === null)
    return { a: null, b: null, reason: 'not_set' };
  if (a.uom !== b.uom) return { a: null, b: null, reason: 'uom_mismatch' };
  if (a.timebase !== b.timebase)
    return { a: null, b: null, reason: 'timebase_mismatch' };
  return { a: da, b: db, reason: null };
}

function step(
  rates: Partial<Record<RateKind, CapacityRate>>,
  [upper, lower]: readonly [RateKind, RateKind],
): CapacityGapStep {
  const pair = comparable(rates[upper], rates[lower]);
  if (pair.reason !== null)
    return { upper, lower, gap: null, ratio: null, reason: pair.reason };
  const gap = pair.a.minus(pair.b);
  const ratio = pair.a.isZero() ? null : formatDec(gap.div(pair.a));
  return { upper, lower, gap: formatDec(gap), ratio, reason: null };
}

function ratio(
  rates: Partial<Record<RateKind, CapacityRate>>,
  [numerator, denominator]: readonly [RateKind, RateKind],
): CapacityRatio {
  const pair = comparable(rates[numerator], rates[denominator]);
  if (pair.reason !== null)
    return { numerator, denominator, ratio: null, reason: pair.reason };
  if (pair.b.isZero())
    return { numerator, denominator, ratio: null, reason: 'zero_base' };
  return {
    numerator,
    denominator,
    ratio: formatDec(pair.a.div(pair.b)),
    reason: null,
  };
}

/** Gaps and utilisation ratios of the approved rates in force for one unit / product (decimal.js). */
export function capacityGaps(
  rates: Partial<Record<RateKind, CapacityRate>>,
): CapacityGaps {
  return {
    gaps: CAPACITY_STEPS.map((pair) => step(rates, pair)),
    ratios: CAPACITY_RATIOS.map((pair) => ratio(rates, pair)),
  };
}
