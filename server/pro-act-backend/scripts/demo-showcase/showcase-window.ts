/**
 * The time window of a showcase run, in UTC (the demo site's timezone) with operational days starting at
 * 06:00: `days` complete past days, today (partial, up to now) and the next `futureDays` days for plans.
 * A re-run on a later day moves the window forward; rows of earlier days are kept.
 */
export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;
export const DAY_START_HOUR = 6;

export interface ShowcaseWindow {
  now: number;
  /** start of the current (partial) operational day */
  today: number;
  /** start of the first past operational day */
  from: number;
  /** end of the plan horizon (exclusive) */
  to: number;
  days: number;
}

export function windowOf(
  now: number,
  days: number,
  futureDays = 7,
): ShowcaseWindow {
  const midnight = Date.UTC(
    new Date(now).getUTCFullYear(),
    new Date(now).getUTCMonth(),
    new Date(now).getUTCDate(),
  );
  const startToday = midnight + DAY_START_HOUR * HOUR_MS;
  const today = startToday <= now ? startToday : startToday - DAY_MS;
  return {
    now,
    today,
    from: today - days * DAY_MS,
    to: today + (futureDays + 1) * DAY_MS,
    days,
  };
}

export const iso = (ms: number): string => new Date(ms).toISOString();

/** `YYYYMMDD` of the operational day starting at `dayStart` */
export function dayKey(dayStart: number): string {
  return iso(dayStart).slice(0, 10).replace(/-/g, '');
}

/** First instant of the calendar month of `ms` (UTC). */
export function monthStart(ms: number): number {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

/** Next month start after `ms` (UTC). */
export function nextMonthStart(ms: number): number {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
}

/** `YYYY-MM` label of a month start */
export function monthLabel(ms: number): string {
  return iso(ms).slice(0, 7);
}
