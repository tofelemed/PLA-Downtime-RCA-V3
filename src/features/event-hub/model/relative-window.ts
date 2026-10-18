import { HOUR_MS, rollingWindow } from '@/api/v2/queries/time-window';

/**
 * Rolling windows ("Last 24 h") kept relative (UX_AUDIT A-5): the URL holds only the key (`window=24h`),
 * never frozen bounds, and the bounds are resolved from "now" each time the page fetches, so a screen
 * left open keeps showing new stops. Explicit (custom, shift) windows stay absolute `from` / `to`.
 */
export const RELATIVE_WINDOWS = [
  { key: '8h', label: 'Last 8 h', hours: 8 },
  { key: '24h', label: 'Last 24 h', hours: 24 },
  { key: '7d', label: 'Last 7 days', hours: 24 * 7 },
  { key: '30d', label: 'Last 30 days', hours: 24 * 30 },
  { key: '90d', label: 'Last 90 days', hours: 24 * 90 },
] as const;

export type RelativeWindow = (typeof RELATIVE_WINDOWS)[number];
export type RelativeWindowKey = RelativeWindow['key'];

/**
 * How often an open page re-resolves a rolling window. New stops appear sooner than this: realtime
 * notices refetch the current window, and the Event Hub window looks ahead past now. Re-resolving
 * returns a paged list to page 1, so it is not done every minute.
 */
export const RELATIVE_WINDOW_REFRESH_MS = 5 * 60_000;

/** The rolling window of a URL `window` value (its key, or the label older links carried); null otherwise. */
export function relativeWindowOf(value: string | null | undefined): RelativeWindow | null {
  if (!value) return null;
  return RELATIVE_WINDOWS.find((entry) => entry.key === value || entry.label === value) ?? null;
}

export interface ResolvedWindow {
  from: string;
  to: string;
}

/**
 * Bounds of a rolling window at `now`: `hours` back from now (minute-stable). `lookaheadMs` extends the
 * end past now so stops starting before the next re-resolve are still listed (the Event Hub uses 1 h).
 */
export function resolveRelativeWindow(window: Pick<RelativeWindow, 'hours'>, now: number, lookaheadMs = 0): ResolvedWindow {
  return rollingWindow(window.hours * HOUR_MS + lookaheadMs, now + lookaheadMs);
}

/** The end shown to people: the resolve instant, without the look-ahead. */
export function displayEnd(resolved: ResolvedWindow, lookaheadMs = 0): string {
  return new Date(Date.parse(resolved.to) - lookaheadMs).toISOString();
}
