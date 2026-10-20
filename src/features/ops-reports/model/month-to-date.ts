import { addCalendarDays, plantLocalToUtc, utcToPlantLocal } from '@/lib/dates';

/**
 * The plant production date the window ends on: the production day holding the instant just before `to`
 * (a production day starts at `dayStart`, plant clock).
 */
export function lastProductionDate(to: string, dayStart: string, timeZone: string): string | null {
  const before = new Date(Date.parse(to) - 1);
  if (Number.isNaN(before.getTime())) return null;
  const local = utcToPlantLocal(before.toISOString(), timeZone);
  const date = local.slice(0, 10);
  return local.slice(11, 16) < dayStart ? addCalendarDays(date, -1) : date;
}

/**
 * Month to date of a report window (R1): from the first production day of the calendar month the window
 * ends in (the month-close month, `YYYY-MM` of the plant date) to the window's end. Null when unknown.
 */
export function monthToDateWindow(window: { to: string }, dayStart: string, timeZone: string): { from: string; to: string } | null {
  const last = lastProductionDate(window.to, dayStart, timeZone);
  if (!last) return null;
  const from = plantLocalToUtc(`${last.slice(0, 8)}01T${dayStart}`, timeZone);
  return from ? { from, to: window.to } : null;
}
