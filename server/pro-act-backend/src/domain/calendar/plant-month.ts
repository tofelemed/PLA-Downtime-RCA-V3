/**
 * A month of the plant calendar (tenant `calendar_system`, CLAUDE.md: a plant setting applies everywhere)
 * as Gregorian dates: `1405-12` on a Persian plant is Esfand 1405. The Jalali arithmetic is the ICU rule
 * the frontend uses (`src/lib/dates/jalali.ts`): year `y` is leap when `(25y + 11) mod 33 < 8`, and
 * Farvardin 1 falls `365(y − 1) + ⌊(8y + 21) / 33⌋` days after the epoch.
 */
export type PlantCalendar = 'gregorian' | 'persian';

const DAY_MS = 86_400_000;
/** Unix epoch day of the day before Farvardin 1, year 1 (calibrated: 1403-01-01 = 2024-03-20). */
const EPOCH_OFFSET = -492_268;
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

const yearStart = (jy: number) =>
  365 * (jy - 1) + Math.floor((8 * jy + 21) / 33);
const daysBeforeMonth = (jm: number) =>
  jm <= 7 ? (jm - 1) * 31 : 186 + (jm - 7) * 30;

const isoOfEpochDay = (day: number) =>
  new Date(day * DAY_MS).toISOString().slice(0, 10);

/** Gregorian ISO date of day 1 of Jalali month `jm` of `jy` (month 13 = Farvardin of the next year). */
function jalaliMonthStart(jy: number, jm: number): string {
  const year = jm > 12 ? jy + 1 : jy;
  const month = jm > 12 ? 1 : jm;
  return isoOfEpochDay(EPOCH_OFFSET + yearStart(year) + daysBeforeMonth(month));
}

function gregorianMonthStart(gy: number, gm: number): string {
  return new Date(Date.UTC(gy, gm - 1, 1)).toISOString().slice(0, 10);
}

/**
 * The first local date of the plant month and of the month after it (`YYYY-MM-DD`, Gregorian), so the
 * month is the half-open local-date range `[first, next)`. null for a malformed month.
 */
export function plantMonthDates(
  month: string,
  calendar: PlantCalendar,
): { first: string; next: string } | null {
  const match = MONTH.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const index = Number(match[2]);
  if (calendar === 'persian') {
    return {
      first: jalaliMonthStart(year, index),
      next: jalaliMonthStart(year, index + 1),
    };
  }
  return {
    first: gregorianMonthStart(year, index),
    next: gregorianMonthStart(year, index + 1),
  };
}
