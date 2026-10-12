/**
 * Exact Solar Hijri (Jalali) ⇄ Gregorian conversion. Display goes through `Intl` with
 * `calendar: 'persian'` (ICU), so this arithmetic deliberately implements ICU's rule rather than the
 * astronomical "breaks" table of jalaali-js: the 33-year cycle where year `y` is leap when
 * `(25y + 11) mod 33 < 8` and Farvardin 1 falls `365(y − 1) + ⌊(8y + 21) / 33⌋` days after the epoch.
 * Tests check agreement with `Intl` for every day of 1300–1500.
 */
export interface JalaliDate {
  jy: number;
  jm: number;
  jd: number;
}

/** A Gregorian calendar date (month 1–12). */
export interface GregorianDate {
  gy: number;
  gm: number;
  gd: number;
}

const DAY_MS = 86_400_000;
/** Unix epoch day of the (proleptic) day before Farvardin 1, year 1 (calibrated: 1403-01-01 = 2024-03-20). */
const EPOCH_OFFSET = -492_268;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Days from the Jalali epoch to Farvardin 1 of `jy`. */
function yearStart(jy: number): number {
  return 365 * (jy - 1) + Math.floor((8 * jy + 21) / 33);
}

/** Days before month `jm` within a year (months 1–6 have 31 days, 7–11 have 30). */
function daysBeforeMonth(jm: number): number {
  return jm <= 7 ? (jm - 1) * 31 : 186 + (jm - 7) * 30;
}

function epochDay(gy: number, gm: number, gd: number): number {
  return Math.floor(Date.UTC(gy, gm - 1, gd) / DAY_MS);
}

/** True when Esfand of `jy` has 30 days. */
export function isJalaliLeapYear(jy: number): boolean {
  const remainder = (((25 * jy + 11) % 33) + 33) % 33;
  return remainder < 8;
}

/** Days in month `jm` (1–12) of `jy`: 31 × 6, 30 × 5, then Esfand 29 or 30. */
export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeapYear(jy) ? 30 : 29;
}

/** True for an existing Jalali date with integer parts (month 1–12, day within the month). */
export function isValidJalaliDate(jy: number, jm: number, jd: number): boolean {
  if (![jy, jm, jd].every(Number.isInteger)) return false;
  if (jy < 1 || jm < 1 || jm > 12 || jd < 1) return false;
  return jd <= jalaliMonthLength(jy, jm);
}

/** Jalali date → Gregorian date (input is assumed valid; see {@link isValidJalaliDate}). */
export function jalaliToGregorian(jy: number, jm: number, jd: number): GregorianDate {
  const day = EPOCH_OFFSET + yearStart(jy) + daysBeforeMonth(jm) + jd - 1;
  const date = new Date(day * DAY_MS);
  return { gy: date.getUTCFullYear(), gm: date.getUTCMonth() + 1, gd: date.getUTCDate() };
}

/** Gregorian date (month 1–12) → Jalali date. */
export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDate {
  const days = epochDay(gy, gm, gd) - EPOCH_OFFSET;
  let jy = 1 + Math.floor((33 * days + 3) / 12053);
  while (yearStart(jy) > days) jy -= 1;
  while (yearStart(jy + 1) <= days) jy += 1;
  const dayOfYear = days - yearStart(jy);
  const jm = dayOfYear < 186 ? Math.floor(dayOfYear / 31) + 1 : Math.floor((dayOfYear - 186) / 30) + 7;
  return { jy, jm, jd: dayOfYear - daysBeforeMonth(jm) + 1 };
}

/** `'2026-10-12'` → `{ jy: 1405, jm: 7, jd: 20 }`; null for a malformed or non-existent date. */
export function isoDateToJalali(isoDate: string): JalaliDate | null {
  const match = ISO_DATE.exec(isoDate);
  if (!match) return null;
  const [gy, gm, gd] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(gy, gm - 1, gd));
  if (check.getUTCFullYear() !== gy || check.getUTCMonth() !== gm - 1 || check.getUTCDate() !== gd) return null;
  return gregorianToJalali(gy, gm, gd);
}

/** `(1405, 7, 20)` → `'2026-10-12'`; null when the Jalali date does not exist. */
export function jalaliToIsoDate(jy: number, jm: number, jd: number): string | null {
  if (!isValidJalaliDate(jy, jm, jd)) return null;
  const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd);
  return `${String(gy).padStart(4, '0')}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
}
