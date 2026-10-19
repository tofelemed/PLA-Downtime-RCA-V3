import { useCalendarPreference } from '@/lib/dates';
import type { AnalyticsScope } from '../model/analytics-scope';
import { windowDatesText } from '../model/window-range';
import { useProductionDayStart } from './use-production-day-start';

/**
 * "2026-10-01 – 2026-10-07", "2026-10-17 (production day 06:00–06:00)", "Production day 2026-10-17 · 22:00–06:00"
 * or "2026-10-12 15:04 – 2026-10-19 15:04" (plant calendar) of a half-open window.
 */
export function useDatesLabel(scope: Pick<AnalyticsScope, 'from' | 'to'>, timeZone: string): string {
  const pref = useCalendarPreference();
  const { dayStart } = useProductionDayStart();
  return windowDatesText({ from: scope.from, to: scope.to }, timeZone, dayStart, pref);
}
