import { Decimal } from 'decimal.js';
import { Dec, toDec } from '../actuals/decimal';

/** Scale of a stored reason weight (as `loss_line_evidence.share`). */
export const WEIGHT_SCALE = 8;
/** Most reasons one stop may be split across. */
export const MAX_REASON_WEIGHTS = 10;

/**
 * D-T5: one reason of a weighted stop and its fraction of the stop (8-place decimal string). Declared mode
 * (Task 13): a `recovery` share of a production loss offsets the loss shares (Σ loss − Σ recovery = 1).
 */
export interface ReasonWeight {
  reasonCodeId: string;
  weight: string;
  recovery?: boolean;
}

/** One reason as the coder enters it: a percent of the stop, a duration in seconds, or tonnes of a production loss. */
export interface ReasonWeightEntry {
  reasonCodeId: string;
  percent?: string | number | null;
  seconds?: string | number | null;
  quantity?: string | number | null;
  /** declared mode: this share is a recovery (Σ loss shares − Σ recovery shares = the shortfall) */
  recovery?: boolean | null;
}

export type ReasonWeightErrorCode =
  | 'REASON_WEIGHTS_EMPTY'
  | 'REASON_WEIGHTS_BASIS'
  | 'REASON_WEIGHTS_DUPLICATE'
  | 'REASON_WEIGHTS_NOT_POSITIVE'
  | 'REASON_WEIGHTS_SUM'
  | 'REASON_WEIGHTS_OPEN_EVENT'
  | 'REASON_WEIGHTS_PRIMARY'
  | 'REASON_WEIGHTS_RECOVERY';

export interface ReasonWeightError {
  code: ReasonWeightErrorCode;
  message: string;
}

/** Normalised weights (null = a single reason, no split) and the primary reason they imply. */
export type ReasonWeightResult =
  | { ok: true; weights: ReasonWeight[] | null; primary: string }
  | { ok: false; error: ReasonWeightError };

export interface ReasonWeightContext {
  /** whole seconds of the closed stop; null while it is open */
  durationSeconds: number | null;
  /** the primary reason the same request names, if any */
  reasonCodeId?: string | null;
  /** the quantity of a production loss event (declared mode); null for a stop, which splits by percent or seconds */
  quantity?: number | null;
}

const fail = (
  code: ReasonWeightErrorCode,
  message: string,
): ReasonWeightResult => ({ ok: false, error: { code, message } });

type Basis = 'percent' | 'seconds' | 'quantity';

const BASES: readonly Basis[] = ['percent', 'seconds', 'quantity'];

const isRecovery = (entry: { recovery?: boolean | null }) =>
  entry.recovery === true;

/** The one basis an entry states, or null when it states none or several. */
function basisOf(entry: ReasonWeightEntry): Basis | null {
  const stated = BASES.filter(
    (basis) => entry[basis] !== undefined && entry[basis] !== null,
  );
  return stated.length === 1 ? stated[0] : null;
}

/** Recovery shares split a production loss only, and never without a loss share beside them. */
function recoveryError(
  entries: readonly ReasonWeightEntry[],
  producedLoss: boolean,
): ReasonWeightError | null {
  if (!entries.some(isRecovery)) return null;
  if (!producedLoss) {
    return {
      code: 'REASON_WEIGHTS_RECOVERY',
      message: 'A recovery share applies to a production loss only',
    };
  }
  return entries.every(isRecovery)
    ? {
        code: 'REASON_WEIGHTS_RECOVERY',
        message: 'Give at least one loss share beside the recovery',
      }
    : null;
}

/** The basis of the entries, or why they do not share one the event allows. */
function basisError(
  entries: readonly ReasonWeightEntry[],
  producedLoss: boolean,
): Basis | ReasonWeightError {
  const basis = basisOf(entries[0]);
  if (!basis || entries.some((entry) => basisOf(entry) !== basis)) {
    return {
      code: 'REASON_WEIGHTS_BASIS',
      message: producedLoss
        ? 'Give every reason either a percent or tonnes, the same for all reasons'
        : 'Give every reason either a percent or a duration in seconds, the same for all reasons',
    };
  }
  if ((basis === 'quantity') !== producedLoss && basis !== 'percent') {
    return {
      code: 'REASON_WEIGHTS_BASIS',
      message: producedLoss
        ? 'A production loss is split by percent or tonnes, not by duration'
        : 'Tonnes split a production loss only; split a stop by percent or seconds',
    };
  }
  return basis;
}

/** The entered values, or the first rule they break. */
function enteredValues(
  entries: readonly ReasonWeightEntry[],
  context: ReasonWeightContext,
): { basis: Basis; values: Dec[] } | ReasonWeightError {
  const producedLoss =
    context.quantity !== undefined && context.quantity !== null;
  const basis = basisError(entries, producedLoss);
  if (typeof basis !== 'string') return basis;
  const recovery = recoveryError(entries, producedLoss);
  if (recovery) return recovery;
  const ids = entries.map((entry) => entry.reasonCodeId);
  if (new Set(ids).size !== ids.length) {
    return {
      code: 'REASON_WEIGHTS_DUPLICATE',
      message: 'A reason is listed more than once',
    };
  }
  const values = entries.map((entry) => toDec(entry[basis] ?? null));
  if (values.some((value) => value === null || value.lte(0))) {
    return {
      code: 'REASON_WEIGHTS_NOT_POSITIVE',
      message: 'Every reason needs a share greater than zero',
    };
  }
  return { basis, values: values as Dec[] };
}

/** The total the values must add up to, or why they do not. */
function checkTotal(
  basis: Basis,
  total: Dec,
  context: ReasonWeightContext & { recovery: boolean },
): ReasonWeightError | null {
  const { durationSeconds } = context;
  if (basis === 'quantity') return checkTonnes(total, context);
  if (basis === 'percent') {
    const what = context.recovery
      ? 'The loss percents less the recovery percents add up to'
      : 'The percents add up to';
    return total.eq(100)
      ? null
      : {
          code: 'REASON_WEIGHTS_SUM',
          message: `${what} ${total.toFixed()} %, not 100 %`,
        };
  }
  if (durationSeconds === null) {
    return {
      code: 'REASON_WEIGHTS_OPEN_EVENT',
      message: 'A running stop can be split by percent only, not by duration',
    };
  }
  return total.minus(durationSeconds).abs().lte(1)
    ? null
    : {
        code: 'REASON_WEIGHTS_SUM',
        message: `The durations add up to ${total.toFixed()} s, not the stop's ${durationSeconds} s`,
      };
}

/** The (net) tonnes must add up to the event's quantity within max(0.001, quantity × 1e-6). */
function checkTonnes(
  total: Dec,
  context: ReasonWeightContext & { recovery: boolean },
): ReasonWeightError | null {
  const quantity = context.quantity ?? 0;
  const tolerance = Math.max(0.001, quantity * 1e-6);
  const what = context.recovery
    ? 'The loss tonnes less the recovery tonnes add up to'
    : 'The tonnes add up to';
  return total.minus(quantity).abs().lte(tolerance)
    ? null
    : {
        code: 'REASON_WEIGHTS_SUM',
        message: `${what} ${total.toFixed()} t, not the event's ${quantity} t`,
      };
}

/**
 * Entry indices: loss shares by value (largest first, ties in entry order), the named primary first among
 * equals, then the recovery shares by value. The primary is always a loss share.
 */
function rankOf(
  entries: readonly ReasonWeightEntry[],
  values: readonly Dec[],
  primary: string | null | undefined,
): number[] | null {
  const recovery = (i: number) => (isRecovery(entries[i]) ? 1 : 0);
  const order = entries
    .map((_, i) => i)
    .sort(
      (a, b) =>
        recovery(a) - recovery(b) || values[b].comparedTo(values[a]) || a - b,
    );
  if (!primary) return order;
  const top = values[order[0]];
  const named = order.find(
    (i) => entries[i].reasonCodeId === primary && !isRecovery(entries[i]),
  );
  if (named === undefined || !values[named].eq(top)) return null;
  return [named, ...order.filter((i) => i !== named)];
}

/**
 * Fractions value ÷ total truncated to 8 places; the first (largest loss share) takes the remainder so
 * that Σ loss fractions − Σ recovery fractions = 1 exactly (`signs[i]` = −1 for a recovery; default all +1).
 */
export function fractionsOf(
  values: readonly Dec[],
  total: Dec,
  signs: readonly number[] = values.map(() => 1),
): Dec[] {
  const rest = values
    .slice(1)
    .map((value) =>
      value.div(total).toDecimalPlaces(WEIGHT_SCALE, Decimal.ROUND_DOWN),
    );
  const assigned = rest.reduce(
    (sum, part, i) => sum.plus(part.mul(signs[i + 1] ?? 1)),
    new Dec(0),
  );
  return [new Dec(1).minus(assigned), ...rest];
}

/** Σ loss values − Σ recovery values. */
function netTotal(entries: readonly ReasonWeightEntry[], values: Dec[]): Dec {
  return values.reduce(
    (sum, v, i) => (isRecovery(entries[i]) ? sum.minus(v) : sum.plus(v)),
    new Dec(0),
  );
}

/**
 * D-T5 (owner decision 2026-10-19): the reasons a coder splits one stop across, entered as percents
 * (Σ = 100) or durations (Σ = the closed stop's length within 1 s), normalised to 8-place fractions that
 * add up to exactly 1, the remainder on the largest. The largest reason is the primary (`reasonCodeId`);
 * among equal largest, the one the request names, else the first entered. One reason is no split
 * (weights null). Declared mode (Task 13): a production loss may carry recovery shares — Σ loss − Σ
 * recovery = the shortfall (percent: = 100) — whose fractions are kept positive and marked `recovery`;
 * the primary is the largest loss share. Deterministic and pure.
 */
export function normaliseReasonWeights(
  entries: readonly ReasonWeightEntry[],
  context: ReasonWeightContext,
): ReasonWeightResult {
  if (entries.length === 0) {
    return fail(
      'REASON_WEIGHTS_EMPTY',
      'Give at least one reason, or null to remove the split',
    );
  }
  const entered = enteredValues(entries, context);
  if ('code' in entered) return { ok: false, error: entered };
  const total = netTotal(entries, entered.values);
  const recovery = entries.some(isRecovery);
  const totalError = checkTotal(entered.basis, total, { ...context, recovery });
  if (totalError) return { ok: false, error: totalError };
  const rank = rankOf(entries, entered.values, context.reasonCodeId);
  if (!rank) {
    return fail(
      'REASON_WEIGHTS_PRIMARY',
      'The reason code must be the reason with the largest share',
    );
  }
  const primary = entries[rank[0]].reasonCodeId;
  if (entries.length === 1) return { ok: true, weights: null, primary };
  const fractions = fractionsOf(
    rank.map((i) => entered.values[i]),
    total,
    rank.map((i) => (isRecovery(entries[i]) ? -1 : 1)),
  );
  return {
    ok: true,
    primary,
    weights: rank.map((i, k) => ({
      reasonCodeId: entries[i].reasonCodeId,
      weight: fractions[k].toFixed(WEIGHT_SCALE),
      ...(isRecovery(entries[i]) ? { recovery: true } : {}),
    })),
  };
}

/** True for a split across two or more reasons. */
export function isWeighted(
  weights: readonly ReasonWeight[] | null | undefined,
): weights is readonly ReasonWeight[] {
  return Array.isArray(weights) && weights.length > 1;
}

/**
 * Σ the loss weights of a split (1 without recovery shares): the event's gross loss is its shortfall times
 * this, the recovery shares offsetting the excess over the shortfall.
 */
export function lossWeightTotal(
  weights: readonly ReasonWeight[] | null | undefined,
): Dec {
  if (!isWeighted(weights)) return new Dec(1);
  return weights
    .filter((w) => !isRecovery(w))
    .reduce((sum, w) => sum.plus(w.weight), new Dec(0));
}

function isReasonWeight(value: unknown): value is ReasonWeight {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.reasonCodeId === 'string' &&
    typeof record.weight === 'string' &&
    toDec(record.weight) !== null &&
    (record.recovery === undefined || typeof record.recovery === 'boolean')
  );
}

/** Stored weights (jsonb) as typed weights; null for no split or an unreadable value. */
export function storedReasonWeights(raw: unknown): ReasonWeight[] | null {
  if (!Array.isArray(raw)) return null;
  const items: unknown[] = raw;
  if (items.length < 2 || !items.every(isReasonWeight)) return null;
  return items.map((item) => ({
    reasonCodeId: item.reasonCodeId,
    weight: item.weight,
    ...(item.recovery === true ? { recovery: true } : {}),
  }));
}
