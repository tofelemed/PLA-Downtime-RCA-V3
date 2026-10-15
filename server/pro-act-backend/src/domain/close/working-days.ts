import { addDays, isoWeekday } from '../calendar/wall-clock';

/** What makes a date a working day for the close calendar (SME R4). */
export interface WorkingCalendar {
  /** ISO weekdays that are not working days (1 = Monday … 7 = Sunday) */
  weekendDays: readonly number[];
  /** operational dates of the plant calendar's holidays */
  holidays: ReadonlySet<string>;
}

/** A guard against a calendar without any working day (every weekday a weekend). */
const MAX_SCAN_DAYS = 366;

export function isWorkingDay(date: string, calendar: WorkingCalendar): boolean {
  return (
    !calendar.weekendDays.includes(isoWeekday(date)) &&
    !calendar.holidays.has(date)
  );
}

/**
 * The `n`-th working day on or after `from` (n ≥ 1): working day 1 is the first working day of the next
 * month when `from` is a month's end date. Holidays and weekend days are skipped, never counted
 * (SME R4 worked example: a holiday right after month end pushes working day 5 out).
 */
export function nthWorkingDay(
  from: string,
  n: number,
  calendar: WorkingCalendar,
): string {
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError(`working day number must be ≥ 1, got ${n}`);
  }
  let found = 0;
  for (let offset = 0; offset < MAX_SCAN_DAYS; offset += 1) {
    const date = addDays(from, offset);
    if (!isWorkingDay(date, calendar)) continue;
    found += 1;
    if (found === n) return date;
  }
  throw new RangeError('the close calendar has no working days');
}
