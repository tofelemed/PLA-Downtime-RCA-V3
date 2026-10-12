import type { CalendarSystem } from './calendar-types';
import { getFormatter, resolveTimeZone } from './intl-cache';

/** Wall-clock parts of an instant in a zone and calendar (Latin digits, zero-padded). */
export interface ZonedParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  /** `+03:30` */
  offset: string;
  /** the zone actually used (`'UTC'` when the requested one is unknown) */
  timeZone: string;
}

/** `GMT+03:30` / `GMT-5` / `GMT` → `+03:30` / `-05:00` / `+00:00`. */
export function normalizeGmtOffset(gmt: string): string {
  const match = /([+-])(\d{1,2})(?::?(\d{2}))?/.exec(gmt);
  if (!match) return '+00:00';
  return `${match[1]}${match[2].padStart(2, '0')}:${match[3] ?? '00'}`;
}

/** Parses an ISO instant (or epoch ms); null when absent or invalid. */
export function toInstant(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

/** Wall-clock parts of `instant` in `timeZone` for `calendar` (era dropped). */
export function zonedParts(instant: Date, timeZone: string, calendar: CalendarSystem = 'gregorian'): ZonedParts {
  const zone = resolveTimeZone(timeZone);
  const parts = getFormatter(calendar, zone, 'datetime').formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    year: part('year'),
    month: part('month'),
    day: part('day'),
    hour: part('hour'),
    minute: part('minute'),
    offset: normalizeGmtOffset(part('timeZoneName')),
    timeZone: zone,
  };
}

/** Offset of `timeZone` at `instantMs`, in minutes east of UTC. */
export function offsetMinutesAt(instantMs: number, timeZone: string): number {
  const { offset } = zonedParts(new Date(instantMs), timeZone);
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === '-' ? -minutes : minutes;
}
