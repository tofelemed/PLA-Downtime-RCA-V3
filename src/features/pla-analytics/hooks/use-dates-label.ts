import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { datesFromRange } from '@/features/ux-kit/date-inputs';
import type { AnalyticsScope } from '../model/analytics-scope';

/** "2026-10-01 – 2026-10-07" (plant calendar, Persian when the plant uses it) of a half-open plant-day window. */
export function useDatesLabel(scope: Pick<AnalyticsScope, 'from' | 'to'>, timeZone: string): string {
  const pref = useCalendarPreference();
  const { start, end } = datesFromRange({ from: scope.from, to: scope.to }, timeZone);
  return `${formatOperationalDate(start, pref)} – ${formatOperationalDate(end, pref)}`;
}
