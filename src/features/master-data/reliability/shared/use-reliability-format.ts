import { useMemo } from 'react';
import { usePlantDates } from '@/features/admin/shared/use-plant-dates';
import { formatDuration } from '@/features/ux-kit/format/duration';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import type { MetricFormat } from '../standby/standby-metrics-model';

export interface ReliabilityFormat extends MetricFormat {
  timezone: string;
  /** plant clock and calendar: `2026-10-12 06:30` */
  dateTime: (iso: string | null | undefined) => string;
}

/** Plant-aware text of the reliability screens: dates in the plant zone / calendar, numbers in its digits. */
export function useReliabilityFormat(): ReliabilityFormat {
  const dates = usePlantDates();
  const numbers = useNumberFormat();
  return useMemo(
    () => ({
      timezone: dates.timezone,
      dateTime: dates.dateTime,
      number: (value: number) => numbers.number(value),
      percent: (value: number, fractionDigits: number) => numbers.percent(value, fractionDigits),
      duration: (seconds: number) => formatDuration(seconds, 'long', numbers.digits),
    }),
    [dates, numbers],
  );
}
