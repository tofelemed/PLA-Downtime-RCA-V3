import type { To } from 'react-router-dom';
import type { LossTreeGroupBy, LossTreeGroupView } from '@/api/v2/types/pla-analytics';
import { LOSS_EVENT_OEE, scopeToParams, type AnalyticsScope, type LossEventOee } from './analytics-scope';
import { PERIODS_PARAM, QUALITY_PERIODS } from './period-list';

/** The server's loss-tree group of quality lines from lot dispositions (no cause event, no reason code). */
export const QUALITY_DISPOSITIONS = 'quality_dispositions';

/** "All units in your scope" or the chosen units' names. */
export function unitsLabel(unitIds: readonly string[], unitName: (id: string) => string): string {
  return unitIds.length === 0 ? 'All units in your scope' : unitIds.map(unitName).join(', ');
}

/** The revision selection in one wording everywhere (filter, badge, captions): QA Reports "Approved only" vs "Approved revisions only". */
export function revisionSelectionLabel(approvedOnly: boolean): string {
  return approvedOnly ? 'Approved revisions only' : 'Approved revision, else the open draft (provisional)';
}

/** What the loss tree and the top opportunities are made of, for the chosen revisions (plain language, no server basis tokens). */
export function lossLinesNote(approvedOnly: boolean): string {
  return approvedOnly
    ? 'From the approved loss lines of each period (approved revisions only).'
    : 'From the calculated loss lines of each period (approved revision, else the open draft); decisions of an open draft show in the waterfall only.';
}

/** Downtime Analysis with the same window and units (the stops behind the losses). */
export function downtimeLink(scope: AnalyticsScope): string {
  const params = new URLSearchParams({ from: scope.from, to: scope.to, window: scope.windowLabel });
  if (scope.unitIds.length > 0) params.set('units', scope.unitIds.join(','));
  if (scope.approvedOnly) params.set('approved', '1');
  return `/downtime/stops?${params.toString()}`;
}

/** Event Hub list of the scope's window and units, coded with the given reasons (its `reasons` URL filter). */
export function eventsByReasonLink(scope: AnalyticsScope, reasonId: string): string {
  const params = new URLSearchParams({ from: scope.from, to: scope.to, window: scope.windowLabel });
  if (scope.unitIds.length > 0) params.set('units', [...scope.unitIds].sort().join(','));
  params.set('reasons', reasonId);
  return `/events?${params.toString()}`;
}

/** A routed PLA page with the same scope (the `tab` parameter is only for links written before the pages). */
function plaPage(pathname: string, scope: AnalyticsScope, own: Readonly<Record<string, string>> = {}): To {
  const params = scopeToParams(scope);
  params.delete('tab');
  for (const [key, value] of Object.entries(own)) params.set(key, value);
  return { pathname, search: `?${params.toString()}` };
}

/** Loss breakdown → Loss events with the same scope, narrowed to an OEE component or a unit. */
export function lossEventsLink(scope: AnalyticsScope, patch: { eventOee?: LossEventOee; unitIds?: string[] }): To {
  return plaPage('/pla-analytics/losses', { ...scope, ...patch }, { breakdown: 'loss-events' });
}

/** The Reconciliation page with the same scope (Unaccounted and over-accounted periods). */
export function reconciliationLink(scope: AnalyticsScope): To {
  return plaPage('/pla-analytics/reconciliation', scope);
}

/**
 * Quality losses come from lot dispositions, not events (QA PLA M3): the periods of the scope, each opening
 * its Actuals & quality section where the dispositions are listed.
 */
export function dispositionsLink(scope: AnalyticsScope): To {
  return plaPage('/pla-analytics/reconciliation', scope, { [PERIODS_PARAM]: QUALITY_PERIODS });
}

const isOee = (key: string): key is Exclude<LossEventOee, 'all'> => key !== 'all' && (LOSS_EVENT_OEE as readonly string[]).includes(key);

/** Why a loss-tree row has no link, in words (shown as the row's hint); null when it has one or needs none. */
export function noLinkReason(groupBy: LossTreeGroupBy, group: Pick<LossTreeGroupView, 'key' | 'eventLines'>): string | null {
  if (groupBy === 'reason' && group.key && group.key !== QUALITY_DISPOSITIONS && group.eventLines === 0) return 'Manual loss lines with no event: nothing to open';
  return null;
}

/**
 * Where a loss-tree row leads (UX audit D-6, QA PLA M3): a reason to its coded events (only when some of
 * its lines explain an event), quality — dispositions, not events — to the periods' dispositions, a unit or
 * an OEE component (a loss kind of the same name) to the loss events of that unit or component; impact rows
 * and the "Not coded" group have no event filter, so no link.
 */
export function lossGroupLink(scope: AnalyticsScope, groupBy: LossTreeGroupBy, group: Pick<LossTreeGroupView, 'key' | 'eventLines'>): To | null {
  const { key } = group;
  if (!key) return null;
  if (groupBy === 'reason') return reasonLink(scope, key, group.eventLines);
  if (groupBy === 'unit') return lossEventsLink(scope, { unitIds: [key] });
  if (groupBy !== 'oee' && groupBy !== 'kind') return null;
  if (key === 'quality') return dispositionsLink(scope);
  return isOee(key) ? lossEventsLink(scope, { eventOee: key }) : null;
}

/** A reason row: quality dispositions to the periods' dispositions, a code to its events when some line has one. */
function reasonLink(scope: AnalyticsScope, key: string, eventLines: number | undefined): To | null {
  if (key === QUALITY_DISPOSITIONS) return dispositionsLink(scope);
  return eventLines === 0 ? null : eventsByReasonLink(scope, key);
}

/**
 * Where a waterfall bar leads: availability / performance to their loss events, quality to the periods'
 * dispositions (QA PLA M3), Unaccounted to reconciliation.
 */
export function waterfallBarLink(scope: AnalyticsScope, key: string): To | null {
  if (key === 'quality') return dispositionsLink(scope);
  if (isOee(key)) return lossEventsLink(scope, { eventOee: key });
  if (key === 'unaccounted' || key === 'over_accounted' || key === 'residual') return reconciliationLink(scope);
  return null;
}
