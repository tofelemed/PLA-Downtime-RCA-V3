import { addDays } from '../calendar/wall-clock';
import {
  FINANCIAL_CALENDARS,
  FinancialCalendar,
  financialMonth,
  isMonthKey,
  monthOfDate,
} from './financial-month';

/**
 * A plausible year never reaches this in the Solar Hijri calendar before Gregorian 2321, and every Gregorian
 * year of plant data lies above it; so a bare key on one side of it cannot belong to the other calendar.
 */
export const CALENDAR_YEAR_SPLIT = 1700;

export type MonthKeyRefusal =
  | 'INVALID_MONTH'
  | 'MONTH_KEY_AMBIGUOUS'
  | 'MONTH_CALENDAR_MISMATCH';

export type MonthKeyResult =
  | { ok: true; key: string }
  | {
      ok: false;
      code: MonthKeyRefusal;
      message: string;
      /** the months of the plant's close calendar the named month overlaps */
      overlaps: string[];
    };

const QUALIFIED = /^(?:([a-z]+):)?(\d{4}-\d{2})$/;

const isCalendar = (value: string): value is FinancialCalendar =>
  (FINANCIAL_CALENDARS as readonly string[]).includes(value);

/** The months of `calendar` that a month of the other calendar overlaps (first and last date). */
function overlapsOf(
  key: string,
  from: FinancialCalendar,
  calendar: FinancialCalendar,
): string[] {
  const month = financialMonth(key, from);
  const first = monthOfDate(month.firstDate, calendar).key;
  const last = monthOfDate(addDays(month.endDate, -1), calendar).key;
  return first === last ? [first] : [first, last];
}

/** The calendar a bare key's year reads as (Solar Hijri years lie below the split, Gregorian above). */
const calendarOfYear = (year: number): FinancialCalendar =>
  year >= CALENDAR_YEAR_SPLIT ? 'gregorian' : 'persian';

function mismatch(
  code: 'MONTH_KEY_AMBIGUOUS' | 'MONTH_CALENDAR_MISMATCH',
  input: { key: string; from: FinancialCalendar; calendar: FinancialCalendar },
): MonthKeyResult {
  const overlaps = overlapsOf(input.key, input.from, input.calendar);
  return {
    ok: false,
    code,
    message:
      `${input.key} is a ${input.from} month; this plant closes ${input.calendar} months ` +
      `(key YYYY-MM or ${input.calendar}:YYYY-MM). It overlaps ${overlaps.join(' and ')}.`,
    overlaps,
  };
}

/**
 * The month key of the plant's close calendar named by `raw`: `YYYY-MM` in that calendar, or the explicit
 * `gregorian:YYYY-MM` / `persian:YYYY-MM`. A key of the other calendar (explicit, or a bare key whose year
 * can only belong to it, e.g. `2026-10` on a Solar Hijri plant) is refused, never mapped: a Gregorian month
 * does not coincide with a Solar Hijri one, and a close step must act on the month the caller meant.
 */
export function resolveMonthKey(
  raw: string,
  calendar: FinancialCalendar,
): MonthKeyResult {
  const match = QUALIFIED.exec(raw);
  const qualifier = match?.[1];
  const key = match?.[2] ?? '';
  if (!match || !isMonthKey(key) || (qualifier && !isCalendar(qualifier))) {
    return {
      ok: false,
      code: 'INVALID_MONTH',
      message: `month must be YYYY-MM or ${calendar}:YYYY-MM in the plant's close calendar`,
      overlaps: [],
    };
  }
  const named = qualifier && isCalendar(qualifier) ? qualifier : null;
  const yearCalendar = calendarOfYear(Number(key.slice(0, 4)));
  if (named && named !== yearCalendar) {
    return {
      ok: false,
      code: 'INVALID_MONTH',
      message: `${raw}: the year is not a ${named} year of plant data`,
      overlaps: [],
    };
  }
  const from = named ?? yearCalendar;
  if (from === calendar) return { ok: true, key };
  return mismatch(named ? 'MONTH_CALENDAR_MISMATCH' : 'MONTH_KEY_AMBIGUOUS', {
    key,
    from,
    calendar,
  });
}
