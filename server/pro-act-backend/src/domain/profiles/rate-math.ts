import { Dec, formatDec, timebaseSeconds, toDec } from '../actuals/decimal';
import { RateTimebase } from '../actuals/actuals.types';

/** A rate as stored: decimal string per timebase. */
export interface StoredRate {
  rate: string | number;
  timebase: RateTimebase;
}

export class RateMathError extends Error {
  constructor(
    readonly code: 'INVALID_RATE' | 'ZERO_RATE',
    message: string,
  ) {
    super(message);
  }
}

function rateOf(stored: StoredRate): Dec {
  const value = toDec(stored.rate);
  if (value === null || value.isNegative()) {
    throw new RateMathError('INVALID_RATE', 'rate must be a decimal ≥ 0');
  }
  return value;
}

/** Quantity per second, exact (decimal.js): 120 t/h → 0.0333… t/s. */
export function ratePerSecond(stored: StoredRate): Dec {
  return rateOf(stored).div(timebaseSeconds(stored.timebase));
}

/**
 * Seconds the unit needs at `stored` to make `quantity` (KPI01 ideal time): 756 at 2/min → 22 680 s.
 * A zero rate has no ideal time (`ZERO_RATE`).
 */
export function idealProductionSeconds(
  quantity: string | number,
  stored: StoredRate,
): Dec {
  const qty = toDec(quantity);
  if (qty === null) {
    throw new RateMathError('INVALID_RATE', 'quantity must be a decimal');
  }
  const perSecond = ratePerSecond(stored);
  if (perSecond.isZero()) {
    throw new RateMathError('ZERO_RATE', 'a zero rate has no ideal time');
  }
  return qty.div(perSecond);
}

/** Quantity made at `stored` over `seconds` (capacity of an interval). */
export function quantityOver(stored: StoredRate, seconds: Dec | number): Dec {
  return ratePerSecond(stored).mul(seconds);
}

/** Decimal string at the stored scale (8 places, half-even). */
export function formatRate(value: Dec): string {
  return formatDec(value);
}
