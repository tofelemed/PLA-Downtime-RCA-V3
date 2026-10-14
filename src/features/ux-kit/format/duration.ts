import { type DigitSystem, formatDuration as formatDurationText } from '@/lib/dates';

/**
 * The one place durations are turned into text (plan 3.1, decision C1): the API speaks seconds; lists
 * show minutes (`compact`), KPI tiles h:mm (`clock`), detail text hours and minutes (`long`).
 */
export type DurationStyle = 'long' | 'compact' | 'clock';

export const NO_VALUE = '—';

/** Seconds from a number or an API decimal string; null when absent or not a finite value ≥ 0. */
export function toSeconds(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const seconds = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

/**
 * `5400` → "1 h 30 min" (long), "90 min" (compact), "1:30" (clock); invalid → "—". The text comes from
 * `@/lib/dates` (one implementation), in the plant's digits when `digits` is given.
 */
export function formatDuration(value: number | string | null | undefined, style: DurationStyle = 'long', digits?: DigitSystem): string {
  return formatDurationText(value, { style, digits });
}
