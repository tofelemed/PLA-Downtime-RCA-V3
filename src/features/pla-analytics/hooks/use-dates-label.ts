import { useCalendarPreference } from '@/lib/dates';
import type { AnalyticsScope } from '../model/analytics-scope';
import { plantDaysOf, plantDaysText } from '../model/window-range';

/** "2026-10-01 – 2026-10-07", "2026-10-17 (production day 06:00–06:00)" (plant calendar) of a half-open window. */
export function useDatesLabel(scope: Pick<AnalyticsScope, 'from' | 'to'>, timeZone: string): string {
  const pref = useCalendarPreference();
  return plantDaysText(plantDaysOf({ from: scope.from, to: scope.to }, timeZone), pref);
}
