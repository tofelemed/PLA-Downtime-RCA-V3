import type { CalendarSystem, DateDisplayOptions, DigitSystem } from './calendar-types';
import { toDigits } from './digits';
import { getFormatter, resolveTimeZone } from './intl-cache';
import { isoDateToJalali } from './jalali';
import { type ZonedParts, toInstant, zonedParts } from './zoned-parts';

/**
 * The one formatter for dates and times (UI/UX audit §10): the plant zone (never the browser's), the
 * tenant calendar (`gregorian` → `2026-10-12`, `persian` → `1405/07/20`) and digit system.
 * Invalid or absent values render as "—".
 */
export const NO_DATE = '—';

/** Options of {@link formatDateTime}: `withZone` appends ` (+03:30 Asia/Tehran)`. */
export interface DateTimeDisplayOptions extends DateDisplayOptions {
  withZone?: boolean;
}

/** Calendar and digits for zone-free values ({@link formatOperationalDate}). */
export interface CalendarDisplayOptions {
  calendar?: CalendarSystem;
  digits?: DigitSystem;
}

type DateValue = string | null | undefined;

function partsOf(value: DateValue, opts: DateDisplayOptions): ZonedParts | null {
  const instant = toInstant(value);
  return instant ? zonedParts(instant, opts.timeZone, opts.calendar ?? 'gregorian') : null;
}

function datePart(p: ZonedParts, calendar: CalendarSystem | undefined): string {
  return calendar === 'persian' ? `${p.year}/${p.month}/${p.day}` : `${p.year}-${p.month}-${p.day}`;
}

const timePart = (p: ZonedParts) => `${p.hour}:${p.minute}`;

/** Plant wall-clock date: `2026-10-12` / `1405/07/20`. */
export function formatDate(value: DateValue, opts: DateDisplayOptions): string {
  const p = partsOf(value, opts);
  return p ? toDigits(datePart(p, opts.calendar), opts.digits) : NO_DATE;
}

/** Plant wall-clock time, 24-hour: `06:30`. */
export function formatTime(value: DateValue, opts: DateTimeDisplayOptions): string {
  const p = partsOf(value, opts);
  if (!p) return NO_DATE;
  const zone = opts.withZone ? ` (${p.offset} ${p.timeZone})` : '';
  return toDigits(`${timePart(p)}${zone}`, opts.digits);
}

/** `2026-10-12 06:30` / `1405/07/20 10:00`; `withZone` → `2026-10-12 06:30 (+03:30 Asia/Tehran)`. */
export function formatDateTime(value: DateValue, opts: DateTimeDisplayOptions): string {
  const p = partsOf(value, opts);
  if (!p) return NO_DATE;
  const zone = opts.withZone ? ` (${p.offset} ${p.timeZone})` : '';
  return toDigits(`${datePart(p, opts.calendar)} ${timePart(p)}${zone}`, opts.digits);
}

/**
 * A half-open interval on the plant clock: same day `2026-10-12 06:00–14:00`, otherwise
 * `2026-10-12 06:00 – 2026-10-13 06:00`; a null end is `2026-10-12 06:00 – ongoing`.
 */
export function formatRange(fromValue: DateValue, toValue: DateValue, opts: DateDisplayOptions): string {
  const from = partsOf(fromValue, opts);
  if (!from) return NO_DATE;
  const start = `${datePart(from, opts.calendar)} ${timePart(from)}`;
  if (toValue === null || toValue === undefined || toValue === '') return toDigits(`${start} – ongoing`, opts.digits);
  const to = partsOf(toValue, opts);
  if (!to) return NO_DATE;
  const sameDay = datePart(from, opts.calendar) === datePart(to, opts.calendar);
  const end = sameDay ? timePart(to) : `${datePart(to, opts.calendar)} ${timePart(to)}`;
  return toDigits(sameDay ? `${start}–${end}` : `${start} – ${end}`, opts.digits);
}

/** An operational date `YYYY-MM-DD` with no zone shift: `2026-10-12` / `1405/07/20`. */
export function formatOperationalDate(isoDate: string | null | undefined, opts: CalendarDisplayOptions = {}): string {
  if (!isoDate) return NO_DATE;
  const jalali = isoDateToJalali(isoDate);
  if (!jalali) return NO_DATE;
  if (opts.calendar !== 'persian') return toDigits(isoDate, opts.digits);
  const pad = (n: number) => String(n).padStart(2, '0');
  return toDigits(`${jalali.jy}/${pad(jalali.jm)}/${pad(jalali.jd)}`, opts.digits);
}

/** Month and year on the plant clock: `Oct 2026` / `Mehr 1405`. */
export function formatMonth(value: DateValue, opts: DateDisplayOptions): string {
  const instant = toInstant(value);
  if (!instant) return NO_DATE;
  const zone = resolveTimeZone(opts.timeZone);
  const parts = getFormatter(opts.calendar ?? 'gregorian', zone, 'month').formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return toDigits(`${part('month')} ${part('year')}`, opts.digits);
}
