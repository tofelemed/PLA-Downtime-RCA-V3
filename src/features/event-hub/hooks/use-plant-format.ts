import { useCallback } from 'react';
import { formatDateTime, useCalendarPreference } from '@/lib/dates';
import { type DurationStyle, formatDuration } from '@/features/ux-kit/format/duration';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { useEventHubEnv } from '../use-event-hub-env';

/**
 * Plain-text plant date-time (`2026-10-12 06:30`) in the tenant calendar, durations and numbers in the
 * plant's digits, for labels, chart text and table cells (re-created when a plant setting changes).
 */
export function usePlantFormat() {
  const { timezone } = useEventHubEnv();
  const preference = useCalendarPreference();
  const numbers = useNumberFormat();
  const dateTime = useCallback((iso: string | null | undefined) => formatDateTime(iso, { timeZone: timezone, ...preference }), [timezone, preference]);
  const duration = useCallback(
    (seconds: number | string | null | undefined, style: DurationStyle = 'long') => formatDuration(seconds, style, preference.digits),
    [preference.digits],
  );
  return { dateTime, duration, timezone, digits: numbers.digits, decimal: numbers.decimal, number: numbers.number, numberText: numbers.text };
}
