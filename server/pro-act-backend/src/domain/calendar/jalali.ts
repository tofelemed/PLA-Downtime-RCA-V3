/**
 * Solar Hijri (Jalali) ⇄ Gregorian date arithmetic for Iranian financial months (SME R4). The same rule as
 * the frontend's `src/lib/dates/jalali.ts` (ICU's 33-year cycle: year `y` is leap when
 * `(25y + 11) mod 33 < 8`), so a month the server closes is the month the browser displays.
 */
export interface JalaliDate {
  jy: number;
  jm: number;
  jd: number;
}

const DAY_MS = 86_400_000;
/** Unix epoch day of the day before Farvardin 1, year 1 (calibrated: 1403-01-01 = 2024-03-20). */
const EPOCH_OFFSET = -492_268;

function yearStart(jy: number): number {
  return 365 * (jy - 1) + Math.floor((8 * jy + 21) / 33);
}

/** Days before month `jm` within a year (months 1–6 have 31 days, 7–11 have 30). */
function daysBeforeMonth(jm: number): number {
  return jm <= 7 ? (jm - 1) * 31 : 186 + (jm - 7) * 30;
}

export function isJalaliLeapYear(jy: number): boolean {
  return (((25 * jy + 11) % 33) + 33) % 33 < 8;
}

export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeapYear(jy) ? 30 : 29;
}

/** Jalali date → ISO Gregorian date `YYYY-MM-DD` (the input is assumed valid). */
export function jalaliToIsoDate(jy: number, jm: number, jd: number): string {
  const day = EPOCH_OFFSET + yearStart(jy) + daysBeforeMonth(jm) + jd - 1;
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** ISO Gregorian date `YYYY-MM-DD` → Jalali date. */
export function isoDateToJalali(isoDate: string): JalaliDate {
  const days =
    Math.floor(Date.parse(`${isoDate}T00:00:00Z`) / DAY_MS) - EPOCH_OFFSET;
  let jy = 1 + Math.floor((33 * days + 3) / 12053);
  while (yearStart(jy) > days) jy -= 1;
  while (yearStart(jy + 1) <= days) jy += 1;
  const dayOfYear = days - yearStart(jy);
  const jm =
    dayOfYear < 186
      ? Math.floor(dayOfYear / 31) + 1
      : Math.floor((dayOfYear - 186) / 30) + 7;
  return { jy, jm, jd: dayOfYear - daysBeforeMonth(jm) + 1 };
}
