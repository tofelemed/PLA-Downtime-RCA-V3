import { useCallback } from 'react';
import { formatDateTime, useCalendarPreference } from '@/lib/dates';
import { useEventHubEnv } from '../use-event-hub-env';

/** Plain-text plant date-time (`2026-10-12 06:30`) in the tenant calendar, for labels and table cells. */
export function usePlantFormat() {
  const { timezone } = useEventHubEnv();
  const preference = useCalendarPreference();
  const dateTime = useCallback((iso: string | null | undefined) => formatDateTime(iso, { timeZone: timezone, ...preference }), [timezone, preference]);
  return { dateTime, timezone };
}
