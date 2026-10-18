import { type DigitSystem, formatDuration as formatDurationText } from '@/lib/dates';

/**
 * The one place durations are turned into text (plan 3.1, UX audit C-3): the API speaks seconds; every
 * screen shows "42 min" / "3 h 25 min" / "2 d 11 h" (never a bare h:mm).
 *
 * @deprecated The styles no longer change the text; they are accepted so existing call sites compile.
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
 * `5400` → "1 h 30 min"; invalid → "—". The text comes from `@/lib/dates` (one implementation), in the
 * plant's digits when `digits` is given. `_style` is ignored (C-3).
 */
export function formatDuration(value: number | string | null | undefined, _style: DurationStyle = 'long', digits?: DigitSystem): string {
  return formatDurationText(value, { digits });
}
