import type { DigitSystem } from './calendar-types';
import { localizeNumber } from './digits';

/**
 * Durations as text — identical output to `features/ux-kit/format/duration.ts` for Latin digits
 * (the API speaks seconds; lists `compact` minutes, KPI tiles `clock` h:mm, detail text `long`).
 */
export type DurationDisplayStyle = 'long' | 'compact' | 'clock';

/** Options of {@link formatDuration}. */
export interface DurationDisplayOptions {
  style?: DurationDisplayStyle;
  digits?: DigitSystem;
}

function toSeconds(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const seconds = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

function long(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

function compact(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  // fixed `1,234` grouping: the browser locale is never consulted
  return `${String(Math.round(seconds / 60)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} min`;
}

function clock(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  return `${hours}:${String(totalMinutes % 60).padStart(2, '0')}`;
}

/** `5400` → "1 h 30 min" (long), "90 min" (compact), "1:30" (clock); invalid → "—". */
export function formatDuration(value: number | string | null | undefined, opts: DurationDisplayOptions = {}): string {
  const seconds = toSeconds(value);
  if (seconds === null) return '—';
  const style = opts.style ?? 'long';
  const text = style === 'compact' ? compact(seconds) : style === 'clock' ? clock(seconds) : long(seconds);
  return localizeNumber(text, opts.digits);
}
