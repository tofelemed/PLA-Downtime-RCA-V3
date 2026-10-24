import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { zonedParts } from '@/lib/dates/zoned-parts';
import { StatusIcon } from '@/lib/icons';

/** "UTC+03:30" for the zone at `at` (DST-safe: the offset is the zone's at that instant). */
function formatUtcOffset(timeZone: string, at: Date): string {
  return `UTC${zonedParts(at, timeZone).offset}`;
}

/**
 * The plant timezone and its current UTC offset; a labelled warning when the zone is unknown (UTC fallback),
 * never while the sites are still loading.
 */
export function PlantTimezoneReadout() {
  const { timezone, source, loading } = usePlantTimezone();
  if (source === 'utc-fallback') {
    if (loading) return null;
    return (
      <span role="status" className="hidden items-center gap-1 whitespace-nowrap text-xs text-warning md:inline-flex">
        <StatusIcon.warning aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        Plant timezone unknown — times in UTC
      </span>
    );
  }
  return (
    <span className="hidden whitespace-nowrap text-xs text-muted-foreground md:inline">
      {`${timezone} · ${formatUtcOffset(timezone, new Date())}`}
    </span>
  );
}
