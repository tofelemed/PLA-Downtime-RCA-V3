import type { BadActorQuery } from '@/api/v2/queries/bad-actors';
import type { BadActorGroupBy, BadActorItemView, BadActorRankBy, BadActorReportView, BadActorTriggerState, BadActorTriggerView } from '@/api/v2/types/bad-actors';
import { formatDate, type DateDisplayOptions } from '@/lib/dates';
import type { StartRcaContext } from '../model/start-rca';
import { displayCount, plural } from '@/features/ux-kit/format/plural';

/** Choices of the CA8 bad-actor review; ranking, window and trigger state are the server's. */
export interface BadActorFilters {
  /** `YYYY-MM` review month in the plant calendar (Jalali on a Persian plant; the server reads it the same way) */
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

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

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

/** The RCA chip state of a bad-actor firing: its case (linked), or the server's open recommendation. */
export function rcaStateOfTrigger(trigger: Pick<BadActorTriggerView, 'rcaId' | 'outcome'>): 'linked' | 'required' | 'none' {
  if (trigger.rcaId) return 'linked';
  return trigger.outcome === 'recommended' ? 'required' : 'none';
}

export function assetText(item: Pick<BadActorItemView, 'assetCode' | 'assetName'>): string {
  return [item.assetCode, item.assetName].filter(Boolean).join(' ') || 'Unknown asset';
}

/** "Start RCA" from a bad actor: a case on the asset's unit, prefilled with the asset and its failure mode. */
export function badActorStartRca(item: BadActorItemView): StartRcaContext {
  const asset = assetText(item);
  const mode = item.failureMode ? ` (${failureModeText(item.failureMode)})` : '';
  return {
    unitId: item.unitId,
    title: `Bad actor: ${asset}${mode}`,
    description: `${asset}${mode} ranks #${item.rank} in the bad-actor review with ${plural(item.stops, 'stop', 'stops')}. Link the stops behind it from Links.`,
  };
}

/**
 * The review window as inclusive plant dates (QA re-test: "2026-08-03 00:00 – 2026-11-01 00:00" read as if
 * 1 Nov were reviewed): the server's bounds are local midnights, so the last day is the one before `to`.
 */
export function reviewWindowDates(report: Pick<BadActorReportView, 'from' | 'to'>, opts: DateDisplayOptions): string {
  const lastDay = new Date(Date.parse(report.to) - 1).toISOString();
  return `${formatDate(report.from, opts)} – ${formatDate(lastDay, opts)}`;
}

/**
 * Which periods the approved figures leave out (QA re-test N7): those still waiting for approval, and apart
 * from them those no approved plan covers (they cannot be approved until planned). Empty when all approved.
 */
export function excludedPeriodsNote(report: Pick<BadActorReportView, 'valuationStatus' | 'periods' | 'approvedPeriods' | 'uncoveredPeriods'>): string {
  if (report.valuationStatus !== 'provisional') return '';
  const uncovered = report.uncoveredPeriods ?? 0;
  const waiting = Math.max(0, report.periods - report.approvedPeriods - uncovered);
  const parts: string[] = [];
  if (waiting > 0) parts.push(`${displayCount(waiting)} of ${plural(report.periods, 'period', 'periods')} not approved yet, so their loss is not included`);
  if (uncovered > 0) parts.push(`${plural(uncovered, 'period', 'periods')} not included: No approved plan covers ${uncovered === 1 ? 'this period' : 'these periods'}`);
  return parts.join('; ');
}

/** Event Hub list of the asset's unplanned stops in the review window (bad-actor row drill-down). */
export function badActorEventsHref(item: Pick<BadActorItemView, 'assetId'>, report: Pick<BadActorReportView, 'from' | 'to'>): string {
  const params = new URLSearchParams({ from: report.from, to: report.to, assets: item.assetId, classes: 'unplanned' });
  return `/events?${params.toString()}`;
}
