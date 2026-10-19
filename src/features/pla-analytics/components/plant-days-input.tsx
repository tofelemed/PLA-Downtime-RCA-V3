import { DateRangeInput, datesFromRange, rangeFromDates, type InstantRange } from '@/features/ux-kit/date-inputs';
import { plantDaysOf, rangeOfPlantDays } from '../model/window-range';

export interface PlantDaysInputProps {
  label: string;
  value: { from: string; to: string };
  timeZone: string;
  /** receives the window of the chosen days, each starting at the shown window's production day start */
  onChange: (range: { from: string; to: string }) => void;
}

/**
 * Inclusive plant days typed in the plant date format (QA PLA M1): a production-day window (06:00–06:00)
 * shows 17 → 17 for one day, and choosing 17 → 17 keeps the 06:00–06:00 day rather than midnight–midnight.
 */
export function PlantDaysInput({ label, value, timeZone, onChange }: PlantDaysInputProps) {
  const days = plantDaysOf(value, timeZone);
  const shown = rangeFromDates(days, timeZone);
  const choose = (range: InstantRange) => {
    const next = rangeOfPlantDays(datesFromRange(range, timeZone), days.boundary, timeZone);
    if (next.from && next.to) onChange({ from: next.from, to: next.to });
  };
  return <DateRangeInput label={label} value={shown} timeZone={timeZone} onChange={choose} textEntry />;
}
