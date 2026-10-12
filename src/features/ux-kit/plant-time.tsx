import { useCalendarPreference } from '@/lib/dates';
import { formatPlantTime } from './format/plant-time';

export interface PlantTimeProps {
  /** UTC instant from the API (ISO 8601) */
  iso: string | null | undefined;
  /** plant IANA timezone (default site, D03) — never the browser zone */
  tz: string;
  withDate?: boolean;
  className?: string;
}

/** `06:00 (+04:00 Asia/Dubai)`: plant wall clock with offset and zone; the UTC instant on hover;
 * the calendar and digits follow `useCalendarPreference()` (Gregorian without a provider). */
export function PlantTime({ iso, tz, withDate = false, className }: PlantTimeProps) {
  const preference = useCalendarPreference();
  return (
    <time className={className} dateTime={iso ?? undefined} title={iso ?? undefined}>
      {formatPlantTime(iso, tz, withDate, preference)}
    </time>
  );
}
