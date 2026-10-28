import { addCalendarDays, plantLocalToUtc, utcToPlantLocal } from '@/lib/dates';

export interface InstantBoundsRange {
  from: string | null;
  to: string | null;
}

/** The production day (`YYYY-MM-DD`) an instant belongs to: plant local time before the day start is the day before. */
function productionDate(iso: string, timeZone: string, dayStart: string): string | null {
  const local = utcToPlantLocal(iso, timeZone);
  if (!local) return null;
  const date = local.slice(0, 10);
  return local.slice(11, 16) < dayStart ? addCalendarDays(date, -1) : date;
}

const midnight = (date: string | null, timeZone: string) => (date ? plantLocalToUtc(`${date}T00:00`, timeZone) : null);
const dayStartOf = (iso: string | null, timeZone: string, dayStart: string) =>
  iso ? plantLocalToUtc(`${utcToPlantLocal(iso, timeZone).slice(0, 10)}T${dayStart}`, timeZone) : null;

/** The midnight after the production day that contains the last instant before `to` (the window is half-open). */
function lastDayEnd(to: string, timeZone: string, dayStart: string): string | null {
  const last = new Date(Date.parse(to) - 1).toISOString();
  const date = productionDate(last, timeZone, dayStart);
  return midnight(date ? addCalendarDays(date, 1) : null, timeZone);
}

/**
 * Owner decision 2026-10-19 "Production-day boundaries" (QA L20): the date fields of the downtime window pick
 * production days (06:00–06:00 plant time), not calendar days. The shared date-range input works on plant
 * midnights; these two maps translate between its midnights and the production-day bounds of the filters,
 * so the window 17 Oct 06:00 – 18 Oct 06:00 reads From 17 Oct, To 17 Oct.
 */
export function toCalendarDayRange(range: InstantBoundsRange, timeZone: string, dayStart: string): InstantBoundsRange {
  return {
    from: range.from ? midnight(productionDate(range.from, timeZone, dayStart), timeZone) : null,
    to: range.to ? lastDayEnd(range.to, timeZone, dayStart) : null,
  };
}

/** The input's plant-midnight range → the same days as production-day bounds (`[first day start, day after last day start)`). */
export function toProductionDayRange(range: InstantBoundsRange, timeZone: string, dayStart: string): InstantBoundsRange {
  return { from: dayStartOf(range.from, timeZone, dayStart), to: dayStartOf(range.to, timeZone, dayStart) };
}
