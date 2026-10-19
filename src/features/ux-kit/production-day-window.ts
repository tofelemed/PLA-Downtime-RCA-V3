import { addCalendarDays, plantLocalToUtc } from '@/lib/dates';
import { datesFromRange, type InstantRange } from './date-inputs';

/**
 * QA re-test decision (production-day boundaries): a date-only selection — the date pickers' calendar-day
 * range — as whole production days that start at the plant's operational day start (`HH:mm`, plant clock):
 * with 06:00, 17 Oct is 17 Oct 06:00 → 18 Oct 06:00. An incomplete range stays empty.
 */
export function productionDayWindow(range: InstantRange, dayStart: string, timeZone: string): InstantRange {
  const days = datesFromRange(range, timeZone);
  if (!days.start || !days.end) return { from: null, to: null };
  return {
    from: plantLocalToUtc(`${days.start}T${dayStart}`, timeZone),
    to: plantLocalToUtc(`${addCalendarDays(days.end, 1)}T${dayStart}`, timeZone),
  };
}
