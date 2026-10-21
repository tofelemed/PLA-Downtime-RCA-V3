import { useWindowRangeText } from '@/features/event-hub/hooks/use-window-range-text';
import type { DowntimeFilters } from '../model/downtime-filters';

/**
 * The analysis window as a new case's description names it: the actual dates on the plant calendar
 * ("1405/07/18 – 1405/07/25"), never only a label like "Chosen dates" (settings audit, 21 Oct 2026).
 */
export function useRcaWindowText(filters: DowntimeFilters): string {
  return useWindowRangeText()({ label: filters.windowLabel, from: filters.from, to: filters.to, relative: filters.relativeWindow !== null });
}
