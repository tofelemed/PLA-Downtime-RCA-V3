import { useCalendarPreference } from '@/lib/dates';
import { formatPlantTime } from './format/plant-time';
import { splitZone } from './plant-time';

export interface PlantTimeRangeProps {
  from: string | null | undefined;
  /** null / undefined: the range is open (`openLabel`) */
  to: string | null | undefined;
  tz: string;
  openLabel?: string;
  /** false: no zone line under the range (the app header shows the plant zone) */
  withZone?: boolean;
  className?: string;
}

/**
 * `2026-10-17 06:00 → 2026-10-18 06:00` with the plant zone once on a small line under it (table cells):
 * the same facts as two `PlantTime`s at about half the width.
 */
export function PlantTimeRange({ from, to, tz, openLabel = 'open-ended', withZone = true, className }: PlantTimeRangeProps) {
  const preference = useCalendarPreference();
  const start = splitZone(formatPlantTime(from, tz, true, preference));
  const end = to ? splitZone(formatPlantTime(to, tz, true, preference)) : null;
  const zone = start.zone ?? end?.zone ?? null;
  return (
    <span className={className}>
      <span className="whitespace-nowrap">
        <time dateTime={from ?? undefined} title={from ?? undefined}>{start.clock}</time>
        {' → '}
        {end ? <time dateTime={to ?? undefined} title={to ?? undefined}>{end.clock}</time> : openLabel}
      </span>
      {withZone && zone && <span className="block whitespace-nowrap text-xs text-muted-foreground"> {zone}</span>}
    </span>
  );
}
