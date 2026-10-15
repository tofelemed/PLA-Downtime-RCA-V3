import { Dec } from '../actuals/decimal';
import { FxRateSnapshot } from './valuation.types';

export interface Conversion {
  amount: Dec | null;
  /** the approved rate versions used: one at the event date, every version of the month for an average */
  fxRateIds: string[];
  reason: string | null;
  /** SME V7: an authorised provisional rate converted (some of) it — the figure is provisional */
  provisional: boolean;
}

export interface ConversionContext {
  fx: readonly FxRateSnapshot[];
  fxPolicy: 'none' | 'snapshot';
  /** SME V6 `period_average`: convert at the time-weighted average over this window instead */
  average?: { from: string; to: string };
  /** refuse the average when a rate in the window deviates from it by more than this ratio */
  maxAverageDeviation?: string | null;
}

type Pair = { from: string; to: string };

const ms = (iso: string | null) => (iso === null ? Infinity : Date.parse(iso));

const covers = (rate: FxRateSnapshot, atMs: number) =>
  ms(rate.from) <= atMs && ms(rate.to) > atMs;

const ofPair = (fx: readonly FxRateSnapshot[], pair: Pair) =>
  fx.filter((r) => r.fromCurrency === pair.from && r.toCurrency === pair.to);

const isProvisional = (rate: FxRateSnapshot) => rate.provisional === true;

/**
 * Approved rate of the pair in force at the instant (approved final versions never overlap, nor do
 * provisional ones): the final rate when one covers it, else an authorised provisional rate (SME V7).
 */
function rateFor(
  fx: readonly FxRateSnapshot[],
  pair: Pair,
  atMs: number,
): FxRateSnapshot | null {
  const found = ofPair(fx, pair)
    .filter((r) => covers(r, atMs))
    .sort(
      (a, b) =>
        Number(isProvisional(a)) - Number(isProvisional(b)) ||
        ms(b.from) - ms(a.from),
    );
  return found[0] ?? null;
}

interface Found {
  rate: Dec;
  ids: string[];
  provisional: boolean;
}

interface Average extends Found {
  pieces: Dec[];
}

/** Time-weighted mean of the pair's approved versions over `[from, to)`; null when an instant has none. */
function averageFor(
  fx: readonly FxRateSnapshot[],
  pair: Pair,
  window: { from: string; to: string },
): Average | null {
  const end = ms(window.to);
  let cursor = ms(window.from);
  let weighted = new Dec(0);
  const ids: string[] = [];
  const pieces: Dec[] = [];
  let provisional = false;
  while (cursor < end) {
    const rate = rateFor(fx, pair, cursor);
    if (!rate) return null;
    const to = Math.min(end, nextChange(fx, pair, cursor, rate));
    weighted = weighted.plus(new Dec(rate.rate).mul(to - cursor));
    if (!ids.includes(rate.id)) ids.push(rate.id);
    pieces.push(new Dec(rate.rate));
    provisional = provisional || isProvisional(rate);
    cursor = to;
  }
  const span = end - ms(window.from);
  if (span <= 0) return null;
  return { rate: weighted.div(span), ids, pieces, provisional };
}

/**
 * Where the rate in force after `cursor` can change: the end of `rate`, or — for a provisional rate —
 * the start of a final rate of the pair that takes over inside it.
 */
function nextChange(
  fx: readonly FxRateSnapshot[],
  pair: Pair,
  cursor: number,
  rate: FxRateSnapshot,
): number {
  const end = ms(rate.to);
  if (!isProvisional(rate)) return end;
  const starts = ofPair(fx, pair)
    .filter((r) => !isProvisional(r))
    .map((r) => ms(r.from))
    .filter((from) => from > cursor && from < end);
  return Math.min(end, ...starts);
}

/** V6: an average that misrepresents a volatile month is refused rather than silently used. */
function representative(average: Average, limit?: string | null): boolean {
  if (!limit) return true;
  return average.pieces.every((rate) =>
    rate.minus(average.rate).abs().div(average.rate).lte(limit),
  );
}

const missing = (reason: string): Conversion => ({
  amount: null,
  fxRateIds: [],
  reason,
  provisional: false,
});

/** The direct pair multiplies, the inverse pair divides (exact arithmetic, not an estimate). */
function applyRate(
  amount: Dec,
  pair: Pair,
  find: (pair: Pair) => Found | null,
): Conversion | null {
  const direct = find(pair);
  if (direct)
    return {
      amount: amount.mul(direct.rate),
      fxRateIds: direct.ids,
      reason: null,
      provisional: direct.provisional,
    };
  const inverse = find({ from: pair.to, to: pair.from });
  if (inverse && !inverse.rate.isZero())
    return {
      amount: amount.div(inverse.rate),
      fxRateIds: inverse.ids,
      reason: null,
      provisional: inverse.provisional,
    };
  return null;
}

function convertAtAverage(
  amount: Dec,
  pair: Pair,
  context: ConversionContext & { average: { from: string; to: string } },
): Conversion {
  const seen = { volatile: false };
  const converted = applyRate(amount, pair, (p) => {
    const average = averageFor(context.fx, p, context.average);
    if (!average) return null;
    if (representative(average, context.maxAverageDeviation)) return average;
    seen.volatile = true;
    return null;
  });
  if (converted) return converted;
  return missing(
    seen.volatile ? 'fx_average_not_representative' : 'fx_rate_missing',
  );
}

/**
 * Converts an amount with approved, dated FX rates (D08, VAL03): the rate in force at the valuation date,
 * or — SME V6 `period_average` — the time-weighted average of the month's approved versions (refused with
 * `fx_average_not_representative` when the month is too volatile for the policy). SME V7: a final rate
 * wins; where none covers the date an authorised provisional rate converts and the result is marked
 * `provisional`. No covering rate, or an `fxPolicy` of `none`, gives a null amount with reason
 * `fx_rate_missing` — never a guessed or unapproved rate.
 */
export function convert(
  amount: Dec,
  pair: Pair,
  at: Date,
  context: ConversionContext,
): Conversion {
  if (pair.from === pair.to)
    return { amount, fxRateIds: [], reason: null, provisional: false };
  if (context.fxPolicy !== 'snapshot') return missing('fx_rate_missing');
  const { average } = context;
  if (average) return convertAtAverage(amount, pair, { ...context, average });
  const atMs = at.getTime();
  const converted = applyRate(amount, pair, (p) => {
    const rate = rateFor(context.fx, p, atMs);
    return rate
      ? {
          rate: new Dec(rate.rate),
          ids: [rate.id],
          provisional: isProvisional(rate),
        }
      : null;
  });
  return converted ?? missing('fx_rate_missing');
}
