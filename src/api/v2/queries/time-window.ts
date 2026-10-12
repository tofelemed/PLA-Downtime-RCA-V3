/**
 * Stable time windows for query keys (docs/UI_UX_AUDIT.md §4: "keys never repeat"). A preset such as
 * "last 7 days" computed from `Date.now()` changes every millisecond, so its cached report was never hit
 * again. The shared factories widen every instant bound to whole minutes (`from` down, `to` up): a
 * window already on minute boundaries is unchanged, a rolling one maps to the same key for a minute,
 * and nothing inside the requested window is ever cut off.
 */
export const MINUTE_MS = 60_000;

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function roundInstant(value: string | undefined | null, direction: 'down' | 'up'): string | undefined | null {
  if (typeof value !== 'string' || !INSTANT.test(value)) return value;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return value;
  const rounded = direction === 'down' ? Math.floor(ms / MINUTE_MS) * MINUTE_MS : Math.ceil(ms / MINUTE_MS) * MINUTE_MS;
  return rounded === ms ? value : new Date(rounded).toISOString();
}

/** `from` floored to the minute (date-only and non-instant values are returned unchanged). */
export function floorToMinute<T extends string | undefined | null>(value: T): T {
  return roundInstant(value, 'down') as T;
}

/** `to` raised to the next whole minute (half-open windows: never drops data inside the window). */
export function ceilToMinute<T extends string | undefined | null>(value: T): T {
  return roundInstant(value, 'up') as T;
}

/** A copy of `params` with `from` / `to` widened to whole minutes; other fields untouched. */
export function stabilizeWindowParams<T extends object>(params: T): T {
  const record = params as Record<string, unknown>;
  const from = record.from;
  const to = record.to;
  if (typeof from !== 'string' && typeof to !== 'string') return params;
  return {
    ...params,
    ...(typeof from === 'string' ? { from: floorToMinute(from) } : {}),
    ...(typeof to === 'string' ? { to: ceilToMinute(to) } : {}),
  };
}

export interface RollingWindow {
  from: string;
  to: string;
}

/**
 * A rolling window ending "now" with minute-stable bounds, for presets (`rollingWindow(7 * DAY_MS)`).
 * Feature code should compute presets with this instead of `new Date().toISOString()`.
 */
export function rollingWindow(durationMs: number, nowMs: number = Date.now()): RollingWindow {
  const to = Math.ceil(nowMs / MINUTE_MS) * MINUTE_MS;
  return { from: new Date(to - durationMs).toISOString(), to: new Date(to).toISOString() };
}

export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
