import { useCallback, useMemo } from 'react';
import { formatDate, formatDateTime, formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';

/** Plant-zone, tenant-calendar text for RCA screens (dates, date-times and calendar days). */
export function useRcaFormat() {
  const { timezone } = usePlantTimezone();
  const preference = useCalendarPreference();
  const dateTime = useCallback((iso: string | null | undefined) => formatDateTime(iso, { timeZone: timezone, ...preference }), [timezone, preference]);
  const date = useCallback((iso: string | null | undefined) => formatDate(iso, { timeZone: timezone, ...preference }), [timezone, preference]);
  /** a stored calendar day (`2026-10-12` or its UTC-midnight instant), shown without a zone shift */
  const day = useCallback((value: string | null | undefined) => formatOperationalDate(value ? value.slice(0, 10) : null, preference), [preference]);
  return useMemo(() => ({ timezone, dateTime, date, day }), [timezone, dateTime, date, day]);
}
