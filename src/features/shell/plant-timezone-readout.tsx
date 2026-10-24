import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';

/** "UTC+03:30" for the zone at `at` (DST-safe: the offset is read from Intl at that instant). */
function formatUtcOffset(timeZone: string, at: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' }).formatToParts(at);
  const raw = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  const offset = raw.replace('GMT', '');
  return offset === '' ? 'UTC+00:00' : `UTC${offset}`;
}

/** The plant timezone and its current UTC offset; a labelled notice while the zone is unknown (UTC fallback). */
export function PlantTimezoneReadout() {
  const { timezone, source } = usePlantTimezone();
  if (source === 'utc-fallback') {
    return (
      <span role="status" className="hidden text-xs text-muted-foreground md:inline">
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
