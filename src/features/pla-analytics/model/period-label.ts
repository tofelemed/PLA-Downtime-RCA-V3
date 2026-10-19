import { formatOperationalDate, formatTime, type CalendarPreference } from '@/lib/dates';

/**
 * A period in one line on the plant calendar: `2026-10-17 C · 22:00` (operational date, shift, plant start
 * time) — no nested brackets; the zone is the page's, given once in its header.
 */
export function periodLabel(row: { localDate: string; shiftName: string | null; utcStart: string }, timeZone: string, pref: CalendarPreference): string {
  const date = [formatOperationalDate(row.localDate, pref), row.shiftName].filter(Boolean).join(' ');
  return `${date} · ${formatTime(row.utcStart, { timeZone, ...pref })}`;
}
