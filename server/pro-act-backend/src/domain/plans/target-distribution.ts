import { Decimal } from 'decimal.js';
import { Dec, formatDec, toDec } from '../actuals/decimal';
import { PlanGenerationError } from './plan.types';

const SCALE = 8;

/** A decimal ≥ 0 with at most 8 places (the stored scale), or 422 `INVALID_TARGET`. */
export function parseTarget(value: string, field = 'target'): Dec {
  const parsed = toDec(value);
  if (
    parsed === null ||
    parsed.isNegative() ||
    parsed.decimalPlaces() > SCALE
  ) {
    throw new PlanGenerationError(
      'INVALID_TARGET',
      `${field} must be a decimal ≥ 0 with at most ${SCALE} places`,
    );
  }
  return parsed;
}

/**
 * Splits `total` over `weights` (PLAN03): each share is `total × wᵢ / Σw` truncated to 8 places, and the
 * **last positive-weight entry takes the remainder**, so the shares add up to `total` exactly and no
 * share is negative (truncation never over-allocates). Zero weights get 0. A positive total with no
 * positive weight is 422 `NO_ELIGIBLE_TIME`: a target cannot sit on a schedule with no eligible time.
 */
export function distribute(total: Dec, weights: readonly Dec[]): Dec[] {
  const zeros = weights.map(() => new Dec(0));
  if (total.isZero()) return zeros;
  const sum = weights.reduce((acc, w) => acc.plus(w), new Dec(0));
  const last = lastPositive(weights);
  if (last < 0 || !sum.gt(0)) {
    throw new PlanGenerationError(
      'NO_ELIGIBLE_TIME',
      'a positive target needs scheduled time with a positive weight',
    );
  }
  let allocated = new Dec(0);
  const shares = weights.map((weight, i) => {
    if (i === last || !weight.gt(0)) return new Dec(0);
    const share = total
      .mul(weight)
      .div(sum)
      .toDecimalPlaces(SCALE, Decimal.ROUND_DOWN);
    allocated = allocated.plus(share);
    return share;
  });
  shares[last] = total.minus(allocated);
  return shares;
}

function lastPositive(weights: readonly Dec[]): number {
  for (let i = weights.length - 1; i >= 0; i--) {
    if (weights[i].gt(0)) return i;
  }
  return -1;
}

/** Σ of decimal strings, formatted at the stored scale. */
export function sumOf(values: readonly string[]): string {
  return formatDec(values.reduce((acc, value) => acc.plus(value), new Dec(0)));
}
