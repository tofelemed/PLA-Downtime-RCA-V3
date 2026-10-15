import type { BadActorQuery } from '@/api/v2/queries/bad-actors';
import type { BadActorGroupBy, BadActorRankBy, BadActorTriggerState } from '@/api/v2/types/bad-actors';
import { utcToPlantLocal } from '@/lib/dates';

/** Choices of the CA8 bad-actor review; ranking, window and trigger state are the server's. */
export interface BadActorFilters {
  /** `YYYY-MM` review month (plant clock) */
  month: string;
  groupBy: BadActorGroupBy;
  rankBy: BadActorRankBy;
  limit: number;
}

export const GROUP_LABELS: Readonly<Record<BadActorGroupBy, string>> = {
  asset: 'Asset',
  failure_mode: 'Asset and failure mode',
};

export const RANK_LABELS: Readonly<Record<BadActorRankBy, string>> = {
  quantity: 'Approved lost quantity',
  value: 'Approved value',
  stops: 'Stops',
};

export const LIMITS = [5, 10, 20] as const;

export const TRIGGER_LABELS: Readonly<Record<BadActorTriggerState, string>> = {
  fired: 'Bad actor (triggered)',
  over_threshold: 'Over the bad-actor limit',
  below: 'Below the limit',
  off: 'Trigger off',
};

export const VIEW_LABELS: Readonly<Record<string, string>> = {
  contribution_margin: 'contribution margin',
  standard_cost: 'standard cost',
  economic_impact: 'economic impact',
};

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The current month on the plant clock (`YYYY-MM`), the default review month. */
export function currentPlantMonth(timeZone: string, now: Date = new Date()): string {
  return utcToPlantLocal(now.toISOString(), timeZone).slice(0, 7);
}

export function filtersFromParams(params: URLSearchParams, fallbackMonth: string): BadActorFilters {
  const month = params.get('month') ?? '';
  const groupBy = params.get('groupBy') === 'failure_mode' ? 'failure_mode' : 'asset';
  const rank = params.get('rankBy');
  const limit = Number(params.get('limit'));
  return {
    month: MONTH.test(month) ? month : fallbackMonth,
    groupBy,
    rankBy: rank === 'value' || rank === 'stops' ? rank : 'quantity',
    limit: (LIMITS as readonly number[]).includes(limit) ? limit : 5,
  };
}

export function paramsFromFilters(filters: BadActorFilters): URLSearchParams {
  return new URLSearchParams({ month: filters.month, groupBy: filters.groupBy, rankBy: filters.rankBy, limit: String(filters.limit) });
}

/** The server query; the money column follows the user's display currency (USD by default). */
export function badActorQuery(filters: BadActorFilters, currency: string): BadActorQuery {
  return {
    month: filters.month,
    groupBy: filters.groupBy,
    rankBy: filters.rankBy,
    limit: filters.limit,
    currency: currency === 'IRR' ? 'IRR' : 'USD',
  };
}

/** `mode:seal leak` → `seal leak`; a reason-code identity or none says so. */
export function failureModeText(identity: string | null): string {
  if (!identity) return '—';
  if (identity.startsWith('mode:')) return identity.slice(5).split('|')[0];
  if (identity.startsWith('reason:')) return 'Reason code (no failure mode)';
  return 'No failure mode recorded';
}
