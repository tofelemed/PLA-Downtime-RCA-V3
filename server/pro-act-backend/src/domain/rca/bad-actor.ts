import { Dec } from '../actuals/decimal';
import { productionThreshold, RcaPolicy } from './rca-policy';

/** CA8 bad-actor ranking: approved lost quantity (default, D14), approved value, or stop count. */
export const BAD_ACTOR_RANKS = ['quantity', 'value', 'stops'] as const;
export type BadActorRank = (typeof BAD_ACTOR_RANKS)[number];

export const BAD_ACTOR_GROUPS = ['asset', 'failure_mode'] as const;
export type BadActorGroup = (typeof BAD_ACTOR_GROUPS)[number];

/** What the ranking compares of one asset (or asset and failure mode). */
export interface RankedFigures {
  key: string;
  /** approved lost quantity in the ranking unit of measure; null = none approved */
  quantity: string | null;
  /** approved value in the ranking currency; null = not valued (never zero) */
  amount: string | null;
  stops: number;
}

const decOrNull = (value: string | null) =>
  value === null ? null : new Dec(value);

function metricOf(row: RankedFigures, rank: BadActorRank): Dec | null {
  if (rank === 'stops') return new Dec(row.stops);
  return decOrNull(rank === 'quantity' ? row.quantity : row.amount);
}

/**
 * Server-side CA8 ranking (pure): largest first on the chosen metric, unknown values (not valued, nothing
 * approved) after every known one, ties by stop count then key, so the order is stable.
 */
export function rankBadActors<T extends RankedFigures>(
  rows: readonly T[],
  rank: BadActorRank,
  limit: number,
): T[] {
  const sorted = [...rows].sort((a, b) => {
    const x = metricOf(a, rank);
    const y = metricOf(b, rank);
    if (x === null || y === null) {
      if (x !== y) return x === null ? 1 : -1;
    } else if (!x.eq(y)) return y.comparedTo(x);
    return b.stops - a.stops || a.key.localeCompare(b.key);
  });
  return sorted.slice(0, limit);
}

/**
 * State of the CA8 cumulative (bad actor) trigger of an asset: `fired` when an evaluation fired in the
 * window; `over_threshold` when the same-mode downtime reaches the policy limit (halved for critical
 * assets) without a firing yet (e.g. events still open or coded later); `below`; `off` without a rule.
 */
export type BadActorTriggerState = 'fired' | 'over_threshold' | 'below' | 'off';

export interface BadActorTrigger {
  state: BadActorTriggerState;
  /** largest same-mode unplanned downtime of the asset in the window */
  seconds: number;
  thresholdSeconds: number | null;
  windowDays: number | null;
  criticalAsset: boolean;
}

export function badActorTrigger(input: {
  policy: RcaPolicy;
  seconds: number;
  criticalAsset: boolean;
  fired: boolean;
}): BadActorTrigger {
  const rule = input.policy.cumulative;
  const base = { seconds: input.seconds, criticalAsset: input.criticalAsset };
  if (!rule)
    return {
      ...base,
      state: input.fired ? 'fired' : 'off',
      thresholdSeconds: null,
      windowDays: null,
    };
  const threshold = productionThreshold(
    input.policy,
    rule.downtimeSeconds,
    input.criticalAsset,
  );
  const state: BadActorTriggerState = input.fired
    ? 'fired'
    : input.seconds >= threshold
      ? 'over_threshold'
      : 'below';
  return {
    ...base,
    state,
    thresholdSeconds: threshold,
    windowDays: rule.windowDays,
  };
}
