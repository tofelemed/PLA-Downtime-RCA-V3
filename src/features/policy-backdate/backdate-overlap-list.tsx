import { PlantTime } from '@/features/ux-kit/plant-time';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { overlapOf } from './backdate-model';

const TITLES = {
  BACKDATE_OVERLAPS_CALCULATION: 'Periods with calculated figures in this range',
  BACKDATE_OVERLAPS_APPROVED_VALUE: 'Periods with approved figures in this range',
} as const;

/** The periods a refused backdate overlaps (409 BACKDATE_OVERLAPS_CALCULATION / _APPROVED_VALUE); nothing otherwise. */
export function BackdateOverlapList({ error }: { error: unknown }) {
  const { timezone } = usePlantTimezone();
  const overlap = overlapOf(error);
  if (!overlap || overlap.periods.length === 0) return null;
  const more = overlap.total - overlap.periods.length;
  return (
    <div className="text-sm" data-testid="backdate-overlap">
      <p className="font-medium">{TITLES[overlap.code]}</p>
      <ul className="list-disc pl-5">
        {overlap.periods.map((period) => (
          <li key={period.periodId}>
            {period.unitName} · {period.localDate}
            {period.shiftName && ` · ${period.shiftName}`} (<PlantTime iso={period.utcStart} tz={timezone} withDate /> – <PlantTime iso={period.utcEnd} tz={timezone} withDate />)
          </li>
        ))}
      </ul>
      {more > 0 && <p className="text-xs text-muted-foreground">and {more} more</p>}
    </div>
  );
}
