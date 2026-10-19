import { datesFromRange, type InstantRange, type LocalDateRange } from '@/features/ux-kit/date-inputs';
import { addCalendarDays, formatOperationalDate, plantLocalToUtc, utcToPlantLocal, type CalendarPreference } from '@/lib/dates';

const MIDNIGHT = '00:00';

/**
 * The plant days of a window and the time they start at. A window whose bounds both fall on the same
 * plant-clock time other than midnight (e.g. 06:00–06:00) is a run of production days, each named by the
 * date it starts on, so one production day reads as one day (QA PLA M1), never "17–18 Oct".
 */
export interface PlantDays extends LocalDateRange {
  /** `HH:mm` on the plant clock where each day starts (`00:00` for calendar days) */
  boundary: string;
}

export function plantDaysOf(range: { from: string; to: string }, timeZone: string): PlantDays {
  const from = utcToPlantLocal(range.from, timeZone);
  const to = utcToPlantLocal(range.to, timeZone);
  const boundary = from.slice(11, 16);
  if (from && to && boundary !== MIDNIGHT && boundary === to.slice(11, 16) && from < to) {
    return { start: from.slice(0, 10), end: addCalendarDays(to.slice(0, 10), -1), boundary };
  }
  return { ...datesFromRange(range, timeZone), boundary: MIDNIGHT };
}

/** Inclusive plant days → the half-open UTC window, each day starting at `boundary` (the production day start). */
export function rangeOfPlantDays(days: LocalDateRange, boundary: string, timeZone: string): InstantRange {
  if (!days.start || !days.end) return { from: null, to: null };
  return {
    from: plantLocalToUtc(`${days.start}T${boundary}`, timeZone),
    to: plantLocalToUtc(`${addCalendarDays(days.end, 1)}T${boundary}`, timeZone),
  };
}

/** `2026-10-17 (production day 06:00–06:00)`, `2026-10-11 – 2026-10-17` — plant calendar and digits. */
export function plantDaysText(days: PlantDays, pref: CalendarPreference): string {
  const start = formatOperationalDate(days.start, pref);
  const dates = days.start === days.end ? start : `${start} – ${formatOperationalDate(days.end, pref)}`;
  if (days.boundary === MIDNIGHT) return dates;
  const noun = days.start === days.end ? 'production day' : 'production days';
  return `${dates} (${noun} ${days.boundary}–${days.boundary})`;
}

/**
 * The scope window in words on the plant calendar: `Last 7 days · 2026-10-11 – 2026-10-17` (inclusive days,
 * tenant calendar and digits), `Chosen dates · 2026-10-17 (production day 06:00–06:00)`; never the browser's locale.
 */
export function windowRangeText(range: { from: string; to: string }, label: string, timeZone: string, pref: CalendarPreference): string {
  const days = plantDaysOf(range, timeZone);
  if (!days.start || !days.end) return label;
  return `${label} · ${plantDaysText(days, pref)}`;
}
