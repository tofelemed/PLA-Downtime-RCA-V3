import { datesFromRange } from '@/features/ux-kit/date-inputs';
import { formatOperationalDate, type CalendarPreference } from '@/lib/dates';

/**
 * The scope window in words on the plant calendar: `Last 7 days · 2026-10-11 – 2026-10-17` (inclusive days,
 * tenant calendar and digits), never the browser's locale.
 */
export function windowRangeText(range: { from: string; to: string }, label: string, timeZone: string, pref: CalendarPreference): string {
  const { start, end } = datesFromRange(range, timeZone);
  if (!start || !end) return label;
  const days = start === end ? formatOperationalDate(start, pref) : `${formatOperationalDate(start, pref)} – ${formatOperationalDate(end, pref)}`;
  return `${label} · ${days}`;
}
