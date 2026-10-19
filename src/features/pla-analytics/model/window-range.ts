import type { InstantRange, LocalDateRange } from '@/features/ux-kit/date-inputs';
import { addCalendarDays, formatOperationalDate, localizeNumber, plantLocalToUtc, utcToPlantLocal, type CalendarPreference } from '@/lib/dates';

const MIDNIGHT = '00:00';
const MINUTE_MS = 60_000;

/**
 * The plant days of a window and the time they start at (owner decision 2026-10-19 "Production-day
 * boundaries"). A window whose bounds both fall on the plant's production-day start (e.g. 06:00–06:00) is
 * a run of production days, each named by the date it starts on, so one production day reads as one day
 * (QA PLA M1), never "17–18 Oct". Bounds at midnight are calendar days. Any other window has no boundary.
 */
export interface PlantDays extends LocalDateRange {
  /** `HH:mm` on the plant clock where each day starts (`00:00` for calendar days); null: not whole days */
  boundary: string | null;
}

const localOf = (iso: string, timeZone: string) => utcToPlantLocal(iso, timeZone);
const timeOf = (local: string) => local.slice(11, 16);

/** The production day (`YYYY-MM-DD`, the date it starts on) an instant falls in. */
export function productionDateOf(iso: string, timeZone: string, dayStart: string): string {
  const local = localOf(iso, timeZone);
  if (!local) return '';
  return timeOf(local) < dayStart ? addCalendarDays(local.slice(0, 10), -1) : local.slice(0, 10);
}

/** The production days a half-open window touches (inclusive), whatever its bounds. */
export function productionDatesOf(range: { from: string; to: string }, timeZone: string, dayStart: string): LocalDateRange {
  const toMs = Date.parse(range.to);
  if (!range.from || Number.isNaN(toMs)) return { start: '', end: '' };
  return {
    start: productionDateOf(range.from, timeZone, dayStart),
    end: productionDateOf(new Date(toMs - MINUTE_MS).toISOString(), timeZone, dayStart),
  };
}

/** Whole days of the window: production days at `dayStart`, calendar days at midnight, else boundary null. */
export function plantDaysOf(range: { from: string; to: string }, timeZone: string, dayStart: string): PlantDays {
  const from = localOf(range.from, timeZone);
  const to = localOf(range.to, timeZone);
  if (!from || !to || from >= to) return { start: '', end: '', boundary: null };
  const boundary = timeOf(from);
  const whole = boundary === timeOf(to) && (boundary === dayStart || boundary === MIDNIGHT);
  if (!whole) return { ...productionDatesOf(range, timeZone, dayStart), boundary: null };
  return { start: from.slice(0, 10), end: addCalendarDays(to.slice(0, 10), -1), boundary };
}

/** Inclusive plant days → the half-open UTC window, each day starting at `boundary` (the production day start). */
export function rangeOfPlantDays(days: LocalDateRange, boundary: string, timeZone: string): InstantRange {
  if (!days.start || !days.end) return { from: null, to: null };
  return {
    from: plantLocalToUtc(`${days.start}T${boundary}`, timeZone),
    to: plantLocalToUtc(`${addCalendarDays(days.end, 1)}T${boundary}`, timeZone),
  };
}

/**
 * Whole production days of a rolling window (Reports, DECISIONS 2026-10-19): the `count` production days
 * that ended at or before `to` — `to` itself when it is a production-day start, else the start of the
 * production day `to` falls in — so "Last 7 days" covers the last 7 complete production days.
 */
export function snapToProductionDays(to: string, count: number, timeZone: string, dayStart: string): { from: string; to: string } | null {
  const lastDay = addCalendarDays(productionDateOf(new Date(Date.parse(to) - MINUTE_MS).toISOString(), timeZone, dayStart), timeOf(localOf(to, timeZone)) === dayStart ? 0 : -1);
  const range = rangeOfPlantDays({ start: addCalendarDays(lastDay, 1 - Math.max(1, count)), end: lastDay }, dayStart, timeZone);
  return range.from && range.to ? { from: range.from, to: range.to } : null;
}

/** `2026-10-17 (production day 06:00–06:00)`, `2026-10-11 – 2026-10-17` — plant calendar and digits. */
export function plantDaysText(days: PlantDays, pref: CalendarPreference): string {
  const start = formatOperationalDate(days.start, pref);
  const dates = days.start === days.end ? start : `${start} – ${formatOperationalDate(days.end, pref)}`;
  if (days.boundary === null || days.boundary === MIDNIGHT) return dates;
  const noun = days.start === days.end ? 'production day' : 'production days';
  return `${dates} (${noun} ${localizeNumber(`${days.boundary}–${days.boundary}`, pref.digits)})`;
}

/** `2026-10-12 15:04` on the plant clock, plant calendar and digits. */
function instantText(iso: string, timeZone: string, pref: CalendarPreference): string {
  const local = localOf(iso, timeZone);
  return `${formatOperationalDate(local.slice(0, 10), pref)} ${localizeNumber(timeOf(local), pref.digits)}`;
}

/**
 * The dates of a window in words, honest about its bounds (QA PLA M1, N6, shift C):
 * - whole production days: `2026-10-17 (production day 06:00–06:00)`; whole calendar days: `2026-10-11 – 2026-10-17`;
 * - part of one production day (a shift): `Production day 2026-10-17 · 22:00–06:00`;
 * - any other window (a rolling "now − 7 d"): `2026-10-12 15:04 – 2026-10-19 15:04`.
 */
export function windowDatesText(range: { from: string; to: string }, timeZone: string, dayStart: string, pref: CalendarPreference): string {
  const days = plantDaysOf(range, timeZone, dayStart);
  if (!days.start || !days.end) return '';
  if (days.boundary !== null) return plantDaysText(days, pref);
  if (days.start === days.end) {
    const times = `${timeOf(localOf(range.from, timeZone))}–${timeOf(localOf(range.to, timeZone))}`;
    return `Production day ${formatOperationalDate(days.start, pref)} · ${localizeNumber(times, pref.digits)}`;
  }
  return `${instantText(range.from, timeZone, pref)} – ${instantText(range.to, timeZone, pref)}`;
}

/**
 * The scope window in words on the plant calendar: `Last 7 days · 2026-10-12 15:04 – 2026-10-19 15:04`,
 * `Chosen dates · 2026-10-17 (production day 06:00–06:00)`; never the browser's locale.
 */
export function windowRangeText(range: { from: string; to: string }, label: string, plant: { timeZone: string; dayStart: string }, pref: CalendarPreference): string {
  const dates = windowDatesText(range, plant.timeZone, plant.dayStart, pref);
  return dates ? `${label} · ${dates}` : label;
}
