import { useCallback, useMemo } from 'react';
import { formatDate, formatDateTime, formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { plantDayOf } from './model/plant-day';

/** Plant-zone, tenant-calendar text for RCA screens (dates, date-times and calendar days). */
export function useRcaFormat() {
  const { timezone } = usePlantTimezone();
  const preference = useCalendarPreference();
  const dateTime = useCallback((iso: string | null | undefined) => formatDateTime(iso, { timeZone: timezone, ...preference }), [timezone, preference]);
  const date = useCallback((iso: string | null | undefined) => formatDate(iso, { timeZone: timezone, ...preference }), [timezone, preference]);
  /** a stored calendar day (`2026-10-12`) as is, or an instant as the plant's day (never the UTC day) */
  const day = useCallback(
    (value: string | null | undefined) => formatOperationalDate(plantDayOf(value, timezone) || null, preference),
    [timezone, preference],
  );
  return useMemo(() => ({ timezone, dateTime, date, day }), [timezone, dateTime, date, day]);
}
