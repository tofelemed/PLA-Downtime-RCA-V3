import type { DowntimeGroupView } from '@/api/v2/types/reports';
import type { StartRcaContext } from '@/features/rca/model/start-rca';
import type { DowntimeFilters } from './downtime-filters';

/** The one unit of the analysis scope, when exactly one is selected (a case belongs to at most one unit). */
const singleUnit = (filters: DowntimeFilters): string | null => (filters.unitIds.length === 1 ? filters.unitIds[0] : null);

/**
 * "Start RCA" from a Pareto reason: a standalone case prefilled with the reason and the analysis window
 * (`windowText`: its dates on the plant calendar, `useRcaWindowText`);
 * the user links the stops (occurrences) from the case. Not-coded bars have no reason to investigate.
 */
export function reasonStartRca(group: DowntimeGroupView, label: string, filters: DowntimeFilters, windowText: string): StartRcaContext | null {
  if (!group.key) return null;
  return {
    unitId: singleUnit(filters),
    title: `Recurring downtime: ${label}`,
    description: `Downtime coded “${label}” stands out in the reason Pareto for ${windowText}. Link the stops behind it from Links.`,
  };
}

/** "Start RCA" from an asset bad actor: a standalone case prefilled with the asset and the window. */
export function assetStartRca(group: DowntimeGroupView, filters: DowntimeFilters, windowText: string): StartRcaContext | null {
  if (!group.key) return null;
  const asset = group.label ?? 'Unknown asset';
  return {
    unitId: singleUnit(filters),
    title: `Bad actor: ${asset}`,
    description: `${asset} is among the largest downtime contributors for ${windowText}. Link the stops behind it from Links.`,
  };
}
