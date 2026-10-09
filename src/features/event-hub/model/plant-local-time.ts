import { plantTimeParts } from '@/features/ux-kit/format/plant-time';

/**
 * `<input type="datetime-local">` values are wall-clock times without a zone. The Event Hub enters
 * times on the plant clock (D03), never the browser's: these helpers convert between that wall clock
 * and UTC instants with the IANA rules in `Intl`.
 */
const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

function offsetMinutes(instantMs: number, timezone: string): number {
  const parts = plantTimeParts(new Date(instantMs).toISOString(), timezone);
  const match = parts ? /^([+-])(\d{2}):(\d{2})$/.exec(parts.offset) : null;
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === '-' ? -minutes : minutes;
}

/** `2026-10-09T08:30` on the plant clock → UTC ISO; null for an empty or malformed value. */
export function plantLocalToUtc(local: string, timezone: string): string | null {
  const match = LOCAL_PATTERN.exec(local.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const wall = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0));
  // the offset at the guessed instant, re-read once at the corrected instant (DST edges)
  const first = wall - offsetMinutes(wall, timezone) * 60_000;
  const second = wall - offsetMinutes(first, timezone) * 60_000;
  return new Date(second).toISOString();
}

/** UTC ISO → `YYYY-MM-DDTHH:mm` on the plant clock (input value); empty for null or invalid. */
export function utcToPlantLocal(iso: string | null | undefined, timezone: string): string {
  if (!iso) return '';
  const parts = plantTimeParts(iso, timezone);
  return parts ? `${parts.date}T${parts.time}` : '';
}
