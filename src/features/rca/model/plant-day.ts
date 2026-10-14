import { startOfPlantDayUtc, utcToPlantLocal } from '@/lib/dates';

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The plant's calendar day (`YYYY-MM-DD`) of a stored value: an instant is shown in the plant zone (never
 * the UTC day of the instant); a bare calendar day is kept as it is. '' for nothing.
 */
export function plantDayOf(value: string | null | undefined, timeZone: string): string {
  if (!value) return '';
  if (CALENDAR_DAY.test(value)) return value;
  return utcToPlantLocal(value, timeZone).slice(0, 10);
}

/** The instant a plant calendar day starts, as the API stores days (null for ''). */
export function plantDayStart(day: string, timeZone: string): string | null {
  if (!day) return null;
  return startOfPlantDayUtc(day, timeZone);
}
