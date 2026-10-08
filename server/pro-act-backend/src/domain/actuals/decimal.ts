import { Decimal } from 'decimal.js';
import { RateTimebase } from './actuals.types';

/**
 * Decimal arithmetic of the quantity engine (DECISIONS A3: decimal.js). 40 significant digits keep
 * `numeric(24,8)` inputs and repeated divisions by a timebase exact enough; results are rounded half-even
 * to 8 decimals, the scale of the stored quantities.
 */
export const Dec = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_EVEN,
});
export type Dec = Decimal;

export const ZERO = new Dec(0);
const RESULT_SCALE = 8;

const TIMEBASE_SECONDS: Readonly<Record<RateTimebase, number>> = {
  s: 1,
  min: 60,
  h: 3600,
  d: 86400,
};

export function timebaseSeconds(timebase: RateTimebase): number {
  return TIMEBASE_SECONDS[timebase];
}

/** A finite decimal from a stored value; null for null, empty or non-numeric input. */
export function toDec(value: string | number | null | undefined): Dec | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  try {
    const parsed = new Dec(value);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

/** Plain decimal string (no exponent), rounded to the stored scale. */
export function formatDec(value: Dec): string {
  const rounded = value.toDecimalPlaces(RESULT_SCALE, Decimal.ROUND_HALF_EVEN);
  return rounded.isZero() ? '0' : rounded.toFixed();
}

/** Seconds between two epoch-millisecond instants, exact. */
export function secondsBetween(fromMs: number, toMs: number): Dec {
  return new Dec(toMs - fromMs).div(1000);
}
