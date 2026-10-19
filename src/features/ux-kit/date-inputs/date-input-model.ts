import {
  type CalendarSystem,
  formatOperationalDate,
  isoDateToJalali,
  jalaliToIsoDate,
  nextPlantDayUtc,
  plantLocalToUtc,
  startOfPlantDayUtc,
  toLatinDigits,
  utcToPlantLocal,
} from '@/lib/dates';

/**
 * Pure helpers behind the ux-kit date inputs: they parse what the user typed in the tenant calendar
 * and always hand ISO values (`YYYY-MM-DD` dates, UTC instants) back to the caller.
 */
export const INVALID_DATE_MESSAGE = 'Enter a valid date (YYYY/MM/DD)';
/** QA PLA N8: a Gregorian field names its own format (`17/10/2026` is not read as a date). */
export const INVALID_GREGORIAN_DATE_MESSAGE = 'Use YYYY-MM-DD, e.g. 2026-10-17';

const invalidDate = (calendar: CalendarSystem) => (calendar === 'persian' ? INVALID_DATE_MESSAGE : INVALID_GREGORIAN_DATE_MESSAGE);
export const RANGE_ORDER_MESSAGE = 'The end date must be on or after the start date';
export const RANGE_ORDER_TIME_MESSAGE = 'The end must be after the start';

const TYPED_DATE = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/;

/** Result of parsing typed text: `value` is an ISO date or `''` (cleared); `error` when unreadable. */
export interface ParsedDateText {
  value: string;
  error: string | null;
}

/** A plant-clock date and time pair (`YYYY-MM-DD`, `HH:mm`; `''` when not set). */
export interface LocalDateTime {
  date: string;
  time: string;
}

/** Inclusive start and end dates of a date range (`YYYY-MM-DD` or `''`). */
export interface LocalDateRange {
  start: string;
  end: string;
}

/** A half-open UTC range as emitted by the range input. */
export interface InstantRange {
  from: string | null;
  to: string | null;
}

/** `1405/07/20`, `۱۴۰۵-۰۷-۲۰` (persian) or `2026-10-12` (gregorian) → ISO date; blank → `''`. */
export function parseDateText(text: string, calendar: CalendarSystem): ParsedDateText {
  const trimmed = toLatinDigits(text.trim());
  if (trimmed === '') return { value: '', error: null };
  const match = TYPED_DATE.exec(trimmed);
  if (!match) return { value: '', error: invalidDate(calendar) };
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const pad = (n: number) => String(n).padStart(2, '0');
  const iso = calendar === 'persian' ? jalaliToIsoDate(y, m, d) : `${match[1]}-${pad(m)}-${pad(d)}`;
  if (!iso || !isoDateToJalali(iso)) return { value: '', error: invalidDate(calendar) };
  return { value: iso, error: null };
}

/** ISO date → the text shown in the field (`1405/07/20` / `2026-10-12`); `''` for empty or invalid. */
export function dateToText(isoDate: string, calendar: CalendarSystem): string {
  if (!isoDate || !isoDateToJalali(isoDate)) return '';
  return formatOperationalDate(isoDate, { calendar });
}

/** Error text when `isoDate` lies outside `[min, max]` (ISO dates), else null. */
export function boundsError(isoDate: string, calendar: CalendarSystem, min?: string, max?: string): string | null {
  if (!isoDate) return null;
  if (min && isoDate < min) return `Enter a date on or after ${dateToText(min, calendar)}`;
  if (max && isoDate > max) return `Enter a date on or before ${dateToText(max, calendar)}`;
  return null;
}

/** UTC instant → plant-clock date and time; empty parts for null or invalid. */
export function splitInstant(iso: string | null, timeZone: string): LocalDateTime {
  const local = utcToPlantLocal(iso, timeZone);
  return local ? { date: local.slice(0, 10), time: local.slice(11, 16) } : { date: '', time: '' };
}

/** Plant-clock date and time → UTC ISO; null without a date; a missing time means 00:00. */
export function joinInstant(local: LocalDateTime, timeZone: string): string | null {
  if (!local.date) return null;
  return plantLocalToUtc(`${local.date}T${local.time || '00:00'}`, timeZone);
}

/** Inclusive dates → half-open UTC range (`to` = start of the day after `end`). */
export function rangeFromDates(range: LocalDateRange, timeZone: string): InstantRange {
  return {
    from: range.start ? startOfPlantDayUtc(range.start, timeZone) : null,
    to: range.end ? nextPlantDayUtc(range.end, timeZone) : null,
  };
}

/** Half-open UTC range → inclusive plant dates (the end date is the day before `to`). */
export function datesFromRange(range: InstantRange, timeZone: string): LocalDateRange {
  const start = range.from ? utcToPlantLocal(range.from, timeZone).slice(0, 10) : '';
  const toMs = range.to ? new Date(range.to).getTime() : Number.NaN;
  const end = Number.isNaN(toMs) ? '' : utcToPlantLocal(new Date(toMs - 1).toISOString(), timeZone).slice(0, 10);
  return { start, end };
}

/** Error when the inclusive end date is before the start date. */
export function dateRangeError(range: LocalDateRange): string | null {
  return range.start && range.end && range.end < range.start ? RANGE_ORDER_MESSAGE : null;
}

/** Error when a half-open instant range is empty or reversed. */
export function instantRangeError(range: InstantRange): string | null {
  if (!range.from || !range.to) return null;
  return new Date(range.to).getTime() <= new Date(range.from).getTime() ? RANGE_ORDER_TIME_MESSAGE : null;
}
