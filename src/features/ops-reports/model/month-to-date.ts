import { addCalendarDays, isoDateToJalali, jalaliToIsoDate, plantLocalToUtc, utcToPlantLocal } from '@/lib/dates';

/** The plant's financial calendar (month close policy): the months a month-to-date window counts in. */
export type FinancialCalendar = 'gregorian' | 'persian';

/** How production days are cut: the day start (`HH:mm`, plant clock), the plant time zone, the financial calendar. */
export interface PlantDays {
  dayStart: string;
  timeZone: string;
  calendar: FinancialCalendar;
}

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

/** The first date (Gregorian `YYYY-MM-DD`) of the financial month holding `date`. */
export function monthStartOf(date: string, calendar: FinancialCalendar): string | null {
  if (calendar === 'gregorian') return `${date.slice(0, 8)}01`;
  const jalali = isoDateToJalali(date);
  return jalali ? jalaliToIsoDate(jalali.jy, jalali.jm, 1) : null;
}

/**
 * Month to date of a report window (R1): from the first production day of the financial month (the month
 * close's calendar) the window ends in, to the window's end. Null when unknown.
 */
export function monthToDateWindow(window: { to: string }, days: PlantDays): { from: string; to: string } | null {
  const last = lastProductionDate(window.to, days.dayStart, days.timeZone);
  const first = last ? monthStartOf(last, days.calendar) : null;
  if (!first) return null;
  const from = plantLocalToUtc(`${first}T${days.dayStart}`, days.timeZone);
  return from ? { from, to: window.to } : null;
}

/**
 * The 12 calendar months ending with the month the window ends in (R12 scorecard, months as the server
 * groups them: `YYYY-MM` of the plant date), from that first production day to the window's end.
 */
export function twelveMonthWindow(window: { to: string }, dayStart: string, timeZone: string): { from: string; to: string } | null {
  const last = lastProductionDate(window.to, dayStart, timeZone);
  if (!last) return null;
  const index = Number(last.slice(0, 4)) * 12 + Number(last.slice(5, 7)) - 1 - 11;
  const first = `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}-01`;
  const from = plantLocalToUtc(`${first}T${dayStart}`, timeZone);
  return from ? { from, to: window.to } : null;
}
