import { useCallback } from 'react';
import { DAY_MS } from '@/api/v2/queries/time-window';
import { formatDateTime, formatTime, useCalendarPreference } from '@/lib/dates';
import { useEventHubEnv } from '../use-event-hub-env';

export interface WindowRangeInput {
  label: string;
  from: string | null;
  /** end as shown to people (a rolling window's resolve instant, without any look-ahead) */
  to: string | null;
}

export interface RangeFormat {
  dateTime: (iso: string) => string;
  time: (iso: string) => string;
}

/**
 * "Last 24 h · 06:15–06:15" (A-5): the label with the bounds it resolved to on the plant clock; times only
 * up to one day, date and time beyond. The label alone while a bound is missing.
 */
export function windowRangeText(window: WindowRangeInput, format: RangeFormat): string {
  if (!window.from || !window.to) return window.label;
  const span = Date.parse(window.to) - Date.parse(window.from);
  const show = span <= DAY_MS ? format.time : format.dateTime;
  return `${window.label} · ${show(window.from)}–${show(window.to)}`;
}

/** {@link windowRangeText} in the plant's zone, calendar and digits. */
export function useWindowRangeText(): (window: WindowRangeInput) => string {
  const { timezone } = useEventHubEnv();
  const preference = useCalendarPreference();
  return useCallback(
    (window: WindowRangeInput) =>
      windowRangeText(window, {
        dateTime: (iso) => formatDateTime(iso, { timeZone: timezone, ...preference }),
        time: (iso) => formatTime(iso, { timeZone: timezone, ...preference }),
      }),
    [timezone, preference],
  );
}
