/**
 * E-4: what a person types as a duration — "2h 30m", "2d 3h", "45m", "1.5h", "2:30" (h:mm) or a bare
 * number of minutes ("150"). Reading the input is UI work; the server derives and stores the duration.
 */
const MINUTES = /^\d+(?:\.\d+)?$/;
const CLOCK = /^(\d+):([0-5]\d)$/;
const UNITS = /^(?:(\d+(?:\.\d+)?)\s*d)?\s*(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+(?:\.\d+)?)\s*m(?:in)?)?$/i;

const round = (seconds: number) => Math.round(seconds * 1000) / 1000;

/** "2d 3h 15m" style text → seconds; NaN when no part is readable. */
function unitsToSeconds(value: string): number {
  const units = UNITS.exec(value);
  if (!units || units.slice(1).every((part) => part === undefined)) return Number.NaN;
  const [, days = '0', hours = '0', minutes = '0'] = units;
  return round(Number(days) * 86_400 + Number(hours) * 3600 + Number(minutes) * 60);
}

/** Seconds (at most 3 decimals, the API's precision); null when empty; NaN when not readable. */
export function parseDurationInput(text: string): number | null {
  const value = text.trim();
  if (value === '') return null;
  if (MINUTES.test(value)) return round(Number(value) * 60);
  const clock = CLOCK.exec(value);
  return clock ? round(Number(clock[1]) * 3600 + Number(clock[2]) * 60) : unitsToSeconds(value);
}

export const DURATION_INPUT_HINT = 'e.g. 2h 30m, 2:30 or 150 (minutes)';
