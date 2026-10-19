import { labelOf, SCHEDULE_CLASS_LABELS } from '@/features/ux-kit/labels';
import type { DowntimeFilters } from './downtime-filters';

export interface FilterNames {
  product: (id: string) => string;
  crew: (id: string) => string;
}

const listText = (label: string, values: readonly string[]) => `${label}: ${values.join(', ')}`;

/**
 * The filters that narrow the summary and breakdowns, in words (owner decision 2026-10-19: the scope line
 * names the active filters, schedule class included). Units and the window are already in the scope line.
 */
export function activeFilterParts(filters: DowntimeFilters, names: FilterNames): string[] {
  const parts: string[] = [];
  if (filters.productIds.length > 0) parts.push(listText('Products', filters.productIds.map(names.product)));
  if (filters.shiftNames.length > 0) parts.push(listText('Shifts', filters.shiftNames));
  if (filters.crewIds.length > 0) parts.push(listText('Crews', filters.crewIds.map(names.crew)));
  if (filters.scheduleClass !== 'all') parts.push(`Schedule class: ${labelOf(SCHEDULE_CLASS_LABELS, filters.scheduleClass)}`);
  if (filters.includeMicroStops) parts.push('Micro-stops included');
  if (filters.approvedOnly) parts.push('Approved only');
  return parts;
}
