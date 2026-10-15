import type { CalendarSystem } from './calendar-types';
import { isoDateToJalali } from './jalali';
import { utcToPlantLocal } from './zoned-time';

/**
 * Months of the plant calendar (`YYYY-MM`): Gregorian months, or Jalali months on a Persian plant
 * (`1405-07` = Mehr 1405). The server reads the same string in the tenant calendar, so a month never
 * changes meaning between screen and report.
 */
const GREGORIAN_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const JALALI_NAMES = ['Farvardin', 'Ordibehesht', 'Khordad', 'Tir', 'Mordad', 'Shahrivar', 'Mehr', 'Aban', 'Azar', 'Dey', 'Bahman', 'Esfand'];

export const monthNames = (calendar: CalendarSystem): readonly string[] => (calendar === 'persian' ? JALALI_NAMES : GREGORIAN_NAMES);

const pad = (value: number, width: number) => String(value).padStart(width, '0');

/** The current month on the plant clock in the plant calendar. */
export function currentPlantMonth(timeZone: string, calendar: CalendarSystem, now: Date = new Date()): string {
  const isoDate = utcToPlantLocal(now.toISOString(), timeZone).slice(0, 10);
  if (calendar !== 'persian') return isoDate.slice(0, 7);
  const jalali = isoDateToJalali(isoDate);
  return jalali ? `${pad(jalali.jy, 4)}-${pad(jalali.jm, 2)}` : isoDate.slice(0, 7);
}

/** `{ year, month }` of a `YYYY-MM` string; null when malformed. */
export function parsePlantMonth(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  return match ? { year: Number(match[1]), month: Number(match[2]) } : null;
}

export const plantMonthOf = (year: number, month: number) => `${pad(year, 4)}-${pad(month, 2)}`;

/** The month `count` months before `value` (same calendar: both have 12 months). */
export function shiftPlantMonth(value: string, count: number): string {
  const parsed = parsePlantMonth(value);
  if (!parsed) return value;
  const index = parsed.year * 12 + (parsed.month - 1) - count;
  return plantMonthOf(Math.floor(index / 12), (index % 12) + 1);
}
