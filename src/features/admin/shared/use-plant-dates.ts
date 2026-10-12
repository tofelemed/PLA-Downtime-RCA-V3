import { useMemo } from 'react';
import { formatDate, formatDateTime, useCalendarPreference } from '@/lib/dates';
import { plantLocalToUtc, utcToPlantLocal } from '@/lib/dates';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';

/**
 * Dates of the administration screens in the plant timezone and calendar setting (Gregorian / Persian):
 * display helpers plus the conversions between a plant day (`YYYY-MM-DD`) and a stored UTC instant.
 */
export function usePlantDates() {
  const { timezone } = usePlantTimezone();
  const preference = useCalendarPreference();
  return useMemo(() => {
    const opts = { timeZone: timezone, ...preference };
    return {
      timezone,
      date: (iso: string | null | undefined) => formatDate(iso, opts),
      dateTime: (iso: string | null | undefined) => formatDateTime(iso, opts),
      /** the plant day of an instant, for a date field */
      dayOf: (iso: string) => utcToPlantLocal(iso, timezone).slice(0, 10),
      /** the last minute of a plant day as a UTC instant (a task due that day is overdue after it) */
      endOfDay: (day: string) => plantLocalToUtc(`${day}T23:59`, timezone) ?? `${day}T23:59:00.000Z`,
    };
  }, [timezone, preference]);
}
