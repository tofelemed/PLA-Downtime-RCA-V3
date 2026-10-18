import type { DigitSystem } from './calendar-types';
import { localizeNumber } from './digits';

/**
 * Durations as text — one rule everywhere (UX audit C-3): under 1 h "42 min", 1–48 h "3 h 25 min", over
 * 48 h "2 d 11 h"; under a minute "45 s". Never a bare `h:mm`, which reads as min:s.
 *
 * @deprecated The styles are kept only so existing call sites compile; every style renders the same text.
 */
export type DurationDisplayStyle = 'long' | 'compact' | 'clock';

/** Options of {@link formatDuration}. */
export interface DurationDisplayOptions {
  /** @deprecated ignored — one duration format everywhere (C-3) */
  style?: DurationDisplayStyle;
  digits?: DigitSystem;
}

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_FROM_HOURS = 48;

function toSeconds(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const seconds = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

function days(totalHours: number): string {
  const wholeDays = Math.floor(totalHours / HOURS_PER_DAY);
  const hours = totalHours % HOURS_PER_DAY;
  return hours === 0 ? `${wholeDays} d` : `${wholeDays} d ${hours} h`;
}

function durationText(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < MINUTES_PER_HOUR) return `${totalMinutes} min`;
  if (totalMinutes > DAYS_FROM_HOURS * MINUTES_PER_HOUR) return days(Math.round(totalMinutes / MINUTES_PER_HOUR));
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;
  return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, '0')} min`;
}

/** `2520` → "42 min", `12300` → "3 h 25 min", `213000` → "2 d 11 h"; invalid → "—". */
export function formatDuration(value: number | string | null | undefined, opts: DurationDisplayOptions = {}): string {
  const seconds = toSeconds(value);
  if (seconds === null) return '—';
  return localizeNumber(durationText(seconds), opts.digits);
}
