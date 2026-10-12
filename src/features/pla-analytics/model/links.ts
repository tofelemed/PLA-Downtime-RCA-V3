import type { AnalyticsScope } from './analytics-scope';

/** "All units in your scope" or the chosen units' names. */
export function unitsLabel(unitIds: readonly string[], unitName: (id: string) => string): string {
  return unitIds.length === 0 ? 'All units in your scope' : unitIds.map(unitName).join(', ');
}

/** What the loss tree and the top opportunities are made of (plain language, no server basis tokens). */
export const LOSS_LINES_NOTE =
  'From the calculated loss lines of each period (approved revision, else the open draft); decisions of an open draft show in the waterfall only.';

/** Downtime Analysis with the same window and units (the stops behind the losses). */
export function downtimeLink(scope: AnalyticsScope): string {
  const params = new URLSearchParams({ from: scope.from, to: scope.to });
  if (scope.unitIds.length > 0) params.set('units', scope.unitIds.join(','));
  return `/downtime?${params.toString()}`;
}
