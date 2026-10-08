/**
 * Plant-local wall-clock arithmetic (spec §3.3, CAL01). A wall time is a local date and time with no
 * zone attached, held as milliseconds "as if UTC" (`Date.UTC(y, m, d, h, min)`), so date and time
 * arithmetic never meets a DST rule. `ZoneTimeline` maps wall times to UTC instants.
 */
export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_TIME = /^([01]\d|2[0-3]):([0-5]\d)(?::00)?$/;

/** `YYYY-MM-DD` → wall milliseconds of its midnight; throws on anything that is not a real date. */
export function wallOfDate(localDate: string): number {
  const match = LOCAL_DATE.exec(localDate);
  if (!match) throw new RangeError(`invalid local date ${localDate}`);
  const [year, month, day] = match.slice(1).map(Number);
  const wall = Date.UTC(year, month - 1, day);
  if (formatWallDate(wall) !== localDate) {
    throw new RangeError(`invalid local date ${localDate}`);
  }
  return wall;
}

/** `HH:mm` (or `HH:mm:00` as Postgres `time` returns it) → milliseconds after midnight. */
export function msOfTime(localTime: string): number {
  const match = LOCAL_TIME.exec(localTime);
  if (!match) throw new RangeError(`invalid local time ${localTime}`);
  return Number(match[1]) * MS_PER_HOUR + Number(match[2]) * MS_PER_MINUTE;
}

export function isLocalDate(value: string): boolean {
  try {
    wallOfDate(value);
    return true;
  } catch {
    return false;
  }
}

export function isLocalTime(value: string): boolean {
  return LOCAL_TIME.test(value);
}

/** `HH:mm` of a time string (drops the `:00` seconds Postgres adds). */
export function normalizeTime(localTime: string): string {
  const ms = msOfTime(localTime);
  return `${pad(Math.floor(ms / MS_PER_HOUR))}:${pad((ms % MS_PER_HOUR) / MS_PER_MINUTE)}`;
}

export function formatWallDate(wall: number): string {
  return new Date(wall).toISOString().slice(0, 10);
}

export function addDays(localDate: string, days: number): string {
  return formatWallDate(wallOfDate(localDate) + days * MS_PER_DAY);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((wallOfDate(to) - wallOfDate(from)) / MS_PER_DAY);
}

/** ISO weekday of a local date: 1 = Monday … 7 = Sunday. */
export function isoWeekday(localDate: string): number {
  const day = new Date(wallOfDate(localDate)).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Local dates `from` … `to` inclusive. */
export function datesInRange(from: string, to: string): string[] {
  const count = daysBetween(from, to) + 1;
  return Array.from({ length: Math.max(0, count) }, (_, i) => addDays(from, i));
}

/** ISO 8601 local label with its offset, e.g. `2026-10-25T02:30:00+02:00` (§3.3, stored with each instance). */
export function formatLocal(utcMs: number, offsetMinutes: number): string {
  const wall = new Date(utcMs + offsetMinutes * MS_PER_MINUTE).toISOString();
  return `${wall.slice(0, 19)}${formatOffset(offsetMinutes)}`;
}

export function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
