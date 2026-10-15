import {
  isoDateToJalali,
  jalaliMonthLength,
  jalaliToIsoDate,
} from '../calendar/jalali';
import { addDays, isLocalDate } from '../calendar/wall-clock';

/** Calendar the financial month follows (SME R4: Iranian plants close Solar Hijri months). */
export const FINANCIAL_CALENDARS = ['gregorian', 'persian'] as const;
export type FinancialCalendar = (typeof FINANCIAL_CALENDARS)[number];

/** A financial month: its key in its calendar and its operational dates `[firstDate, endDate)`. */
export interface FinancialMonth {
  calendar: FinancialCalendar;
  /** `YYYY-MM` in the month's calendar (`1405-12` = Esfand 1405) */
  key: string;
  firstDate: string;
  /** the first date after the month (exclusive) */
  endDate: string;
}

const MONTH_KEY = /^(\d{4})-(\d{2})$/;

const pad = (value: number, size = 2) => String(value).padStart(size, '0');

/** Whether `key` names a month (`YYYY-MM`, month 01–12). */
export function isMonthKey(key: string): boolean {
  const match = MONTH_KEY.exec(key);
  if (!match) return false;
  const month = Number(match[2]);
  return Number(match[1]) > 0 && month >= 1 && month <= 12;
}

/** The financial month of `key` in `calendar`; throws on a malformed key. */
export function financialMonth(
  key: string,
  calendar: FinancialCalendar,
): FinancialMonth {
  if (!isMonthKey(key)) throw new RangeError(`invalid month ${key}`);
  const [year, month] = key.split('-').map(Number);
  if (calendar === 'persian') {
    const firstDate = jalaliToIsoDate(year, month, 1);
    return {
      calendar,
      key,
      firstDate,
      endDate: addDays(firstDate, jalaliMonthLength(year, month)),
    };
  }
  const next = month === 12 ? `${year + 1}-01` : `${year}-${pad(month + 1)}`;
  return { calendar, key, firstDate: `${key}-01`, endDate: `${next}-01` };
}

/** The financial month an operational date belongs to. */
export function monthOfDate(
  localDate: string,
  calendar: FinancialCalendar,
): FinancialMonth {
  if (!isLocalDate(localDate))
    throw new RangeError(`invalid date ${localDate}`);
  if (calendar === 'persian') {
    const { jy, jm } = isoDateToJalali(localDate);
    return financialMonth(`${pad(jy, 4)}-${pad(jm)}`, calendar);
  }
  return financialMonth(localDate.slice(0, 7), calendar);
}

/** The month before `month` in the same calendar. */
export function previousMonth(month: FinancialMonth): FinancialMonth {
  return monthOfDate(addDays(month.firstDate, -1), month.calendar);
}

/** The month after `month` in the same calendar. */
export function nextMonth(month: FinancialMonth): FinancialMonth {
  return monthOfDate(month.endDate, month.calendar);
}
