import { DateTime } from 'luxon';
import { BoundedInterval } from '../time/interval-algebra';

/** One production day of the plant clipped to a window: its operational date and UTC bounds. */
export interface CalendarDay {
  /** operational date (YYYY-MM-DD): the local date on which the day starts */
  localDate: string;
  start: Date;
  end: Date;
}

/** Upper bound of days one window may produce (the reports allow 400 days). */
const MAX_DAYS = 402;

function timeParts(dayStart: string): {
  hour: number;
  minute: number;
  second: number;
} {
  const [hour = 0, minute = 0, second = 0] = dayStart
    .split(':')
    .map((part) => Number(part));
  return { hour, minute, second };
}

/** UTC instant at which the operational day `localDate` starts in `zone` (DST-correct, luxon). */
function dayStartAt(localDate: string, zone: string, dayStart: string): Date {
  return DateTime.fromISO(localDate, { zone })
    .set(timeParts(dayStart))
    .toUTC()
    .toJSDate();
}

/** Operational date of an instant: the local date of `instant − dayStart` in `zone`. */
export function operationalDateOf(
  instant: Date,
  zone: string,
  dayStart: string,
): string {
  const local = DateTime.fromJSDate(instant, { zone }).minus(
    timeParts(dayStart),
  );
  return local.toISODate() ?? '';
}

const nextDate = (localDate: string) =>
  DateTime.fromISO(localDate, { zone: 'UTC' }).plus({ days: 1 }).toISODate() ??
  '';

/**
 * The plant's production days (24 h of calendar time in the plant timezone from the operational day start,
 * 23 or 25 h on a DST change) that intersect `window`, each clipped to it (half-open). Days are contiguous
 * and sorted; an empty window gives none.
 */
export function calendarDays(
  window: BoundedInterval,
  zone: string,
  dayStart: string,
): CalendarDay[] {
  const days: CalendarDay[] = [];
  let localDate = operationalDateOf(window.start, zone, dayStart);
  while (days.length < MAX_DAYS) {
    const start = dayStartAt(localDate, zone, dayStart);
    if (start >= window.end) break;
    const following = nextDate(localDate);
    const end = dayStartAt(following, zone, dayStart);
    const clippedStart = start > window.start ? start : window.start;
    const clippedEnd = end < window.end ? end : window.end;
    if (clippedEnd > clippedStart) {
      days.push({ localDate, start: clippedStart, end: clippedEnd });
    }
    localDate = following;
  }
  return days;
}
