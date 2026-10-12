import { type CalendarPreference, DEFAULT_CALENDAR_PREFERENCE, formatDateTime, formatTime } from '@/lib/dates';

/**
 * Plant-local time with zone and offset (spec §3.3, I14; D03 Asia/Tehran). Uses the IANA database in
 * `Intl` — no client clock or browser zone is involved, so every viewer sees the plant's wall clock.
 */
export interface PlantTimeParts {
  date: string;
  time: string;
  /** `+03:30` */
  offset: string;
  timezone: string;
}

/** `GMT+03:30` / `GMT-5` / `GMT` → `+03:30` / `-05:00` / `+00:00`. */
export function normalizeOffset(gmt: string): string {
  const match = /([+-])(\d{1,2})(?::?(\d{2}))?/.exec(gmt);
  if (!match) return '+00:00';
  return `${match[1]}${match[2].padStart(2, '0')}:${match[3] ?? '00'}`;
}

function isValidZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** Parts of `iso` in `timezone` (an unknown zone falls back to UTC, visibly). */
export function plantTimeParts(iso: string, timezone: string): PlantTimeParts | null {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return null;
  const zone = isValidZone(timezone) ? timezone : 'UTC';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
    offset: normalizeOffset(part('timeZoneName')),
    timezone: zone,
  };
}

/**
 * `06:00 (+04:00 Asia/Dubai)`, with `withDate` `2026-10-09 06:00 (+04:00 Asia/Dubai)`; invalid → "—".
 * Delegates to `@/lib/dates`; a Persian `preference` gives `1405/07/20 10:00 (+03:30 Asia/Tehran)`.
 */
export function formatPlantTime(
  iso: string | null | undefined,
  timezone: string,
  withDate = false,
  preference: CalendarPreference = DEFAULT_CALENDAR_PREFERENCE,
): string {
  const options = { timeZone: timezone, ...preference, withZone: true };
  return withDate ? formatDateTime(iso, options) : formatTime(iso, options);
}
