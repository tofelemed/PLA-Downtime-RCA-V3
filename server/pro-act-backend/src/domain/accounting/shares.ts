import { Decimal } from 'decimal.js';
import { Dec } from '../actuals/decimal';

/** Scale of `loss_line_evidence.share` (numeric(9,8)). */
export const SHARE_SCALE = 8;

/**
 * `n` equal shares that add up to exactly 1 at the stored scale (ACC05 conservation): each share is
 * 1/n truncated to 8 places and the last one takes the remainder (1/3 → 0.33333333, 0.33333333,
 * 0.33333334). Deterministic: the order of the causes decides who carries the remainder.
 */
export function equalShares(n: number): Dec[] {
  if (n <= 0) return [];
  const each = new Dec(1)
    .div(n)
    .toDecimalPlaces(SHARE_SCALE, Decimal.ROUND_DOWN);
  const shares = Array.from({ length: n - 1 }, () => each);
  const assigned = each.mul(n - 1);
  return [...shares, new Dec(1).minus(assigned)];
}
