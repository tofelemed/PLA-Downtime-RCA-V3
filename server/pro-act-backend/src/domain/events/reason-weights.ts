import { Decimal } from 'decimal.js';
import { Dec, toDec } from '../actuals/decimal';

/** Scale of a stored reason weight (as `loss_line_evidence.share`). */
export const WEIGHT_SCALE = 8;
/** Most reasons one stop may be split across. */
export const MAX_REASON_WEIGHTS = 10;

/** D-T5: one reason of a weighted stop and its fraction of the stop (8-place decimal string). */
export interface ReasonWeight {
  reasonCodeId: string;
  weight: string;
}

/** One reason as the coder enters it: a percent of the stop or a duration in seconds. */
export interface ReasonWeightEntry {
  reasonCodeId: string;
  percent?: string | number | null;
  seconds?: string | number | null;
}

export type ReasonWeightErrorCode =
  | 'REASON_WEIGHTS_EMPTY'
  | 'REASON_WEIGHTS_BASIS'
  | 'REASON_WEIGHTS_DUPLICATE'
  | 'REASON_WEIGHTS_NOT_POSITIVE'
  | 'REASON_WEIGHTS_SUM'
  | 'REASON_WEIGHTS_OPEN_EVENT'
  | 'REASON_WEIGHTS_PRIMARY';

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
}

const fail = (
  code: ReasonWeightErrorCode,
  message: string,
): ReasonWeightResult => ({ ok: false, error: { code, message } });

type Basis = 'percent' | 'seconds';

function basisOf(entry: ReasonWeightEntry): Basis | null {
  const hasPercent = entry.percent !== undefined && entry.percent !== null;
  const hasSeconds = entry.seconds !== undefined && entry.seconds !== null;
  if (hasPercent === hasSeconds) return null;
  return hasPercent ? 'percent' : 'seconds';
}

/** The entered values, or the first rule they break. */
function enteredValues(
  entries: readonly ReasonWeightEntry[],
): { basis: Basis; values: Dec[] } | ReasonWeightError {
  const basis = basisOf(entries[0]);
  if (!basis || entries.some((entry) => basisOf(entry) !== basis)) {
    return {
      code: 'REASON_WEIGHTS_BASIS',
      message:
        'Give every reason either a percent or a duration in seconds, the same for all reasons',
    };
  }
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
  durationSeconds: number | null,
): ReasonWeightError | null {
  if (basis === 'percent') {
    return total.eq(100)
      ? null
      : {
          code: 'REASON_WEIGHTS_SUM',
          message: `The percents add up to ${total.toFixed()} %, not 100 %`,
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

/** Entry indices by value (largest first, ties in entry order), the named primary first among equals. */
function rankOf(
  entries: readonly ReasonWeightEntry[],
  values: readonly Dec[],
  primary: string | null | undefined,
): number[] | null {
  const order = entries
    .map((_, i) => i)
    .sort((a, b) => values[b].comparedTo(values[a]) || a - b);
  if (!primary) return order;
  const top = values[order[0]];
  const named = order.find((i) => entries[i].reasonCodeId === primary);
  if (named === undefined || !values[named].eq(top)) return null;
  return [named, ...order.filter((i) => i !== named)];
}

/** Fractions value ÷ total truncated to 8 places; the first (largest) takes the remainder (Σ = 1 exactly). */
export function fractionsOf(values: readonly Dec[], total: Dec): Dec[] {
  const rest = values
    .slice(1)
    .map((value) =>
      value.div(total).toDecimalPlaces(WEIGHT_SCALE, Decimal.ROUND_DOWN),
    );
  const assigned = rest.reduce((sum, part) => sum.plus(part), new Dec(0));
  return [new Dec(1).minus(assigned), ...rest];
}

/**
 * D-T5 (owner decision 2026-10-19): the reasons a coder splits one stop across, entered as percents
 * (Σ = 100) or durations (Σ = the closed stop's length within 1 s), normalised to 8-place fractions that
 * add up to exactly 1, the remainder on the largest. The largest reason is the primary (`reasonCodeId`);
 * among equal largest, the one the request names, else the first entered. One reason is no split
 * (weights null). Deterministic and pure.
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
  const entered = enteredValues(entries);
  if ('code' in entered) return { ok: false, error: entered };
  const total = entered.values.reduce((sum, v) => sum.plus(v), new Dec(0));
  const totalError = checkTotal(entered.basis, total, context.durationSeconds);
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
  );
  return {
    ok: true,
    primary,
    weights: rank.map((i, k) => ({
      reasonCodeId: entries[i].reasonCodeId,
      weight: fractions[k].toFixed(WEIGHT_SCALE),
    })),
  };
}

/** True for a split across two or more reasons. */
export function isWeighted(
  weights: readonly ReasonWeight[] | null | undefined,
): weights is readonly ReasonWeight[] {
  return Array.isArray(weights) && weights.length > 1;
}

function isReasonWeight(value: unknown): value is ReasonWeight {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.reasonCodeId === 'string' &&
    typeof record.weight === 'string' &&
    toDec(record.weight) !== null
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
  }));
}
