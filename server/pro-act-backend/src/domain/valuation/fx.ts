import { Dec } from '../actuals/decimal';
import { FxRateSnapshot } from './valuation.types';

export interface Conversion {
  amount: Dec | null;
  fxRateId: string | null;
  reason: string | null;
}

const covers = (rate: FxRateSnapshot, atMs: number) =>
  Date.parse(rate.from) <= atMs &&
  (rate.to === null || Date.parse(rate.to) > atMs);

/** Latest-starting approved rate of the pair in force at the instant (approved versions never overlap). */
function rateFor(
  fx: readonly FxRateSnapshot[],
  pair: { from: string; to: string },
  atMs: number,
): FxRateSnapshot | null {
  const found = fx
    .filter(
      (r) =>
        r.fromCurrency === pair.from &&
        r.toCurrency === pair.to &&
        covers(r, atMs),
    )
    .sort((a, b) => Date.parse(b.from) - Date.parse(a.from));
  return found[0] ?? null;
}

/**
 * Converts an amount at the valuation date with an approved, dated FX rate (D08, VAL03): the direct pair
 * multiplies, the inverse pair divides (exact arithmetic, not an estimate). No covering rate, or an
 * `fxPolicy` of `none`, gives a null amount with reason `fx_rate_missing` — never a guessed rate.
 */
export function convert(
  amount: Dec,
  pair: { from: string; to: string },
  at: Date,
  context: { fx: readonly FxRateSnapshot[]; fxPolicy: 'none' | 'snapshot' },
): Conversion {
  if (pair.from === pair.to) return { amount, fxRateId: null, reason: null };
  const missing = { amount: null, fxRateId: null, reason: 'fx_rate_missing' };
  if (context.fxPolicy !== 'snapshot') return missing;
  const atMs = at.getTime();
  const direct = rateFor(context.fx, pair, atMs);
  if (direct) {
    return {
      amount: amount.mul(direct.rate),
      fxRateId: direct.id,
      reason: null,
    };
  }
  const inverse = rateFor(context.fx, { from: pair.to, to: pair.from }, atMs);
  if (inverse && !new Dec(inverse.rate).isZero()) {
    return {
      amount: amount.div(inverse.rate),
      fxRateId: inverse.id,
      reason: null,
    };
  }
  return missing;
}
