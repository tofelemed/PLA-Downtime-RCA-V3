import { offsetMinutesAt, toInstant, zonedParts } from './zoned-parts';

/**
 * Plant wall clock ⇄ UTC with the IANA rules in `Intl` (D03): inputs are entered on the plant clock,
 * never the browser's; the API speaks UTC instants. Unknown zones fall back to UTC.
 */
const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** `2026-10-09T08:30` on the plant clock → UTC ISO (`toISOString()`); null when empty or malformed. */
export function plantLocalToUtc(local: string, timeZone: string): string | null {
  const match = LOCAL_PATTERN.exec(local.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const wall = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0));
  if (Number.isNaN(wall)) return null;
  // the offset at the guessed instant, re-read once at the corrected instant (DST edges)
  const first = wall - offsetMinutesAt(wall, timeZone) * 60_000;
  const second = wall - offsetMinutesAt(first, timeZone) * 60_000;
  return new Date(second).toISOString();
}

/** UTC ISO → `YYYY-MM-DDTHH:mm` (Gregorian) on the plant clock; empty for null or invalid. */
export function utcToPlantLocal(iso: string | null | undefined, timeZone: string): string {
  const instant = toInstant(iso);
  if (!instant) return '';
  const p = zonedParts(instant, timeZone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** UTC ISO of 00:00 plant time on `isoDate` (`YYYY-MM-DD`): the inclusive start of that plant day. */
export function startOfPlantDayUtc(isoDate: string, timeZone: string): string | null {
  if (!DATE_PATTERN.test(isoDate)) return null;
  return plantLocalToUtc(`${isoDate}T00:00`, timeZone);
}

/** UTC ISO of 00:00 plant time on the day after `isoDate`: the exclusive end of a half-open day range. */
export function nextPlantDayUtc(isoDate: string, timeZone: string): string | null {
  if (!DATE_PATTERN.test(isoDate)) return null;
  const next = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(next.getTime())) return null;
  next.setUTCDate(next.getUTCDate() + 1);
  return startOfPlantDayUtc(next.toISOString().slice(0, 10), timeZone);
}
