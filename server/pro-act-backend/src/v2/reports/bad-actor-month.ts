import { resolveMonthKey } from '../../domain/close/month-key';
import {
  PlantCalendar,
  plantMonthDates,
} from '../../domain/calendar/plant-month';
import { invalid } from '../../profiles/profile-errors';

/**
 * The local dates of the review month, under the month-key rule of month close (QA re-test: `1405-07` on a
 * Gregorian plant was read as the Gregorian year 1405): a bare key whose year belongs to the other calendar
 * is refused with 422 `MONTH_KEY_AMBIGUOUS` naming the plant months it overlaps, never mapped silently.
 */
export function reviewMonthDates(
  month: string,
  calendar: PlantCalendar,
): { first: string; next: string } {
  const resolved = resolveMonthKey(month, calendar);
  if (!resolved.ok) throw invalid(resolved.code, resolved.message);
  const dates = plantMonthDates(resolved.key, calendar);
  if (!dates) throw invalid('INVALID_MONTH', 'month must be YYYY-MM');
  return dates;
}
