import { useCalendarPreference } from '@/lib/dates';
import { formatPlantTime } from './format/plant-time';

export interface PlantTimeProps {
  /** UTC instant from the API (ISO 8601) */
  iso: string | null | undefined;
  /** plant IANA timezone (default site, D03) — never the browser zone */
  tz: string;
  withDate?: boolean;
  /** table cells: the zone "(+03:30 Asia/Tehran)" on its own small line, so the column stays narrow */
  stacked?: boolean;
  /** `false`: the wall clock only, without "(+03:30 Asia/Tehran)" (where the page already states the plant timezone) */
  withZone?: boolean;
  className?: string;
}

/** `2026-10-09 06:00 (+04:00 Asia/Dubai)` → wall clock and zone, apart (the zone is null for "—"). */
export function splitZone(text: string): { clock: string; zone: string | null } {
  const match = /^(.*\S) (\([^()]*\))$/.exec(text);
  return match ? { clock: match[1], zone: match[2] } : { clock: text, zone: null };
}

/** `06:00 (+04:00 Asia/Dubai)`: plant wall clock with offset and zone; the UTC instant on hover;
 * the calendar and digits follow `useCalendarPreference()` (Gregorian without a provider). */
export function PlantTime({ iso, tz, withDate = false, stacked = false, withZone = true, className }: PlantTimeProps) {
  const preference = useCalendarPreference();
  const formatted = formatPlantTime(iso, tz, withDate, preference);
  const text = withZone ? formatted : splitZone(formatted).clock;
  if (!stacked) {
    return (
      <time className={className} dateTime={iso ?? undefined} title={iso ?? undefined}>
        {text}
      </time>
    );
  }
  const { clock, zone } = splitZone(text);
  return (
    <time className={className} dateTime={iso ?? undefined} title={iso ?? undefined}>
      <span className="whitespace-nowrap">{clock}</span>
      {zone && <span className="block whitespace-nowrap text-xs text-muted-foreground"> {zone}</span>}
    </time>
  );
}
