import { useMemo } from 'react';
import { formatDateTime, formatRange, useCalendarPreference } from '@/lib/dates';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';

export interface PlantDates {
  timezone: string;
  /** true when no plant timezone is configured and UTC is used */
  utcFallback: boolean;
  /** `2026-10-12 06:30` on the plant clock, in the tenant calendar */
  dateTime: (iso: string | null | undefined) => string;
  /** `2026-10-12 06:00 – ongoing` for a half-open validity */
  validity: (from: string | null | undefined, to: string | null | undefined) => string;
}

/**
 * Date display of the codes & rules and finance screens: plant zone (said once in the page header,
 * not per cell), tenant calendar (Gregorian / Persian) and digits.
 */
export function usePlantDates(): PlantDates {
  const { timezone, source } = usePlantTimezone();
  const preference = useCalendarPreference();
  return useMemo(() => {
    const opts = { timeZone: timezone, ...preference };
    return {
      timezone,
      utcFallback: source === 'utc-fallback',
      dateTime: (iso) => formatDateTime(iso, opts),
      validity: (from, to) => formatRange(from, to, opts),
    };
  }, [timezone, source, preference]);
}
