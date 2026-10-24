import {
  type CalendarSystem,
  type DigitSystem,
  addCalendarDays,
  isoDateToJalali,
  jalaliMonthLength,
  jalaliToIsoDate,
  monthNames,
  toDigits,
} from '@/lib/dates';

/** A month in the plant calendar: Gregorian, or Solar Hijri (`persian`, month 1 = Farvardin). */
export interface CalendarMonth {
  year: number;
  month: number;
}

/** One day cell: its ISO (Gregorian) date and its day number in the shown calendar. */
export interface CalendarDay {
  iso: string;
  day: number;
}

export type CalendarWeek = ReadonlyArray<CalendarDay | null>;

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
/** The plant week starts on Saturday unless the plant says otherwise (Iranian week). */
const DEFAULT_WEEK_START = 6;

const pad = (value: number) => String(value).padStart(2, '0');

/** Index (0 = Sunday) of a stored plant week start; Saturday when unknown or unset. */
export function weekStartIndex(weekStart: string | null | undefined): number {
  const index = WEEKDAYS.indexOf(weekStart as (typeof WEEKDAYS)[number]);
  return index < 0 ? DEFAULT_WEEK_START : index;
}

/** Short weekday names in week order, starting on the plant week start. */
export function weekdayLabels(weekStart: string | null | undefined): string[] {
  const start = weekStartIndex(weekStart);
  return WEEKDAY_SHORT.map((_, offset) => WEEKDAY_SHORT[(start + offset) % 7]);
}

/** The month (in `calendar`) that contains the ISO date. */
export function monthOfDate(isoDate: string, calendar: CalendarSystem): CalendarMonth {
  if (calendar === 'persian') {
    const jalali = isoDateToJalali(isoDate);
    if (jalali) return { year: jalali.jy, month: jalali.jm };
  }
  const [year, month] = isoDate.split('-').map(Number);
  return { year, month };
}

/** The month `count` months after `month` (negative: before). Both calendars have 12 months. */
export function shiftMonth({ year, month }: CalendarMonth, count: number): CalendarMonth {
  const index = year * 12 + (month - 1) + count;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** "October 2026" / "Mehr ۱۴۰۵": the month name and the year in the plant digits. */
export function monthTitle({ year, month }: CalendarMonth, calendar: CalendarSystem, digits: DigitSystem): string {
  return `${monthNames(calendar)[month - 1]} ${toDigits(String(year), digits)}`;
}

function daysOfMonth({ year, month }: CalendarMonth, calendar: CalendarSystem): CalendarDay[] {
  if (calendar === 'persian') {
    const length = jalaliMonthLength(year, month);
    return Array.from({ length }, (_, i) => ({ iso: jalaliToIsoDate(year, month, i + 1) ?? '', day: i + 1 }));
  }
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length }, (_, i) => ({ iso: `${year}-${pad(month)}-${pad(i + 1)}`, day: i + 1 }));
}

/** ISO date of the first day of `month`. */
export function firstDayOf(month: CalendarMonth, calendar: CalendarSystem): string {
  return daysOfMonth(month, calendar)[0].iso;
}

/** Weeks of seven cells (blank outside the month), each week starting on the plant week start. */
export function monthWeeks(month: CalendarMonth, calendar: CalendarSystem, weekStart: string | null | undefined): CalendarWeek[] {
  const days = daysOfMonth(month, calendar);
  const firstWeekday = new Date(`${days[0].iso}T00:00:00Z`).getUTCDay();
  const lead = (firstWeekday - weekStartIndex(weekStart) + 7) % 7;
  const cells: Array<CalendarDay | null> = [...Array<null>(lead).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

const KEY_STEPS: Readonly<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

/** The day an arrow key moves to (left/right one day, up/down one week); null for other keys. */
export function moveDay(isoDate: string, key: string): string | null {
  const step = KEY_STEPS[key];
  return step === undefined ? null : addCalendarDays(isoDate, step);
}
