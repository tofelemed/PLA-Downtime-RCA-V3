import type { To } from 'react-router-dom';
import type { LossTreeGroupBy } from '@/api/v2/types/pla-analytics';
import { LOSS_EVENT_OEE, scopeToParams, type AnalyticsScope, type LossEventOee } from './analytics-scope';

/** "All units in your scope" or the chosen units' names. */
export function unitsLabel(unitIds: readonly string[], unitName: (id: string) => string): string {
  return unitIds.length === 0 ? 'All units in your scope' : unitIds.map(unitName).join(', ');
}

/** What the loss tree and the top opportunities are made of (plain language, no server basis tokens). */
export const LOSS_LINES_NOTE =
  'From the calculated loss lines of each period (approved revision, else the open draft); decisions of an open draft show in the waterfall only.';

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

/** This page's Losses → Loss events with the same scope, narrowed to an OEE component or a unit. */
export function lossEventsLink(scope: AnalyticsScope, patch: { eventOee?: LossEventOee; unitIds?: string[] }): To {
  const params = scopeToParams({ ...scope, ...patch, tab: 'losses' });
  params.set('breakdown', 'loss-events');
  return { search: `?${params.toString()}` };
}

/** This page's Reconciliation view with the same scope (Unaccounted and over-accounted periods). */
export function reconciliationLink(scope: AnalyticsScope): To {
  return { search: `?${scopeToParams({ ...scope, tab: 'reconciliation' }).toString()}` };
}

const isOee = (key: string): key is Exclude<LossEventOee, 'all'> => key !== 'all' && (LOSS_EVENT_OEE as readonly string[]).includes(key);

/**
 * Where a loss-tree row leads (UX audit D-6): a reason to its coded events, a unit or an OEE component (a
 * loss kind of the same name) to the loss events of that unit or component; impact rows and the "Not coded"
 * group have no event filter, so no link.
 */
export function lossGroupLink(scope: AnalyticsScope, groupBy: LossTreeGroupBy, key: string | null): To | null {
  if (!key) return null;
  if (groupBy === 'reason') return eventsByReasonLink(scope, key);
  if (groupBy === 'unit') return lossEventsLink(scope, { unitIds: [key] });
  if ((groupBy === 'oee' || groupBy === 'kind') && isOee(key)) return lossEventsLink(scope, { eventOee: key });
  return null;
}

/** Where a waterfall bar leads: availability / performance / quality to their loss events, Unaccounted to reconciliation. */
export function waterfallBarLink(scope: AnalyticsScope, key: string): To | null {
  if (isOee(key)) return lossEventsLink(scope, { eventOee: key });
  if (key === 'unaccounted' || key === 'over_accounted' || key === 'residual') return reconciliationLink(scope);
  return null;
}
