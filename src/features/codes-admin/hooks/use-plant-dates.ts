import { useMemo } from 'react';
import { formatDateTime, formatRange, useCalendarPreference } from '@/lib/dates';
import { BUILT_IN_DEFAULT_START, isBuiltInDefaultStart } from '@/features/ux-kit/format/built-in-default';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';

export interface PlantDates {
  timezone: string;
  /** true when no plant timezone is configured and UTC is used */
  utcFallback: boolean;
  /** `2026-10-12 06:30` on the plant clock, in the tenant calendar */
  dateTime: (iso: string | null | undefined) => string;
  /** `2026-10-12 06:00 – ongoing` for a half-open validity; a seeded default reads "Built-in default (from the start)" */
  validity: (from: string | null | undefined, to: string | null | undefined) => string;
  /** the start of a version, or "Built-in default (from the start)" for the epoch sentinel */
  effectiveFrom: (iso: string | null | undefined) => string;
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
    const dateTime = (iso: string | null | undefined) => formatDateTime(iso, opts);
    const validity = (from: string | null | undefined, to: string | null | undefined) => {
      if (!isBuiltInDefaultStart(from)) return formatRange(from, to, opts);
      return to ? `${BUILT_IN_DEFAULT_START} – ${dateTime(to)}` : BUILT_IN_DEFAULT_START;
    };
    return {
      timezone,
      utcFallback: source === 'utc-fallback',
      dateTime,
      validity,
      effectiveFrom: (iso) => (isBuiltInDefaultStart(iso) ? BUILT_IN_DEFAULT_START : dateTime(iso)),
    };
  }, [timezone, source, preference]);
}
