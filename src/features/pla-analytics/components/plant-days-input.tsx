import { DateRangeInput, rangeFromDates, datesFromRange, type DateRangeInputProps, type InstantRange } from '@/features/ux-kit/date-inputs';
import { plantDaysOf, rangeOfPlantDays } from '../model/window-range';

/** Presentation options passed through to the date range fields (labels, calendar button). */
type FieldOptions = Pick<DateRangeInputProps, 'toLabel' | 'calendarPicker' | 'weekStart' | 'hideLegend' | 'toolbar'>;

export interface PlantDaysInputProps extends FieldOptions {
  label: string;
  value: { from: string; to: string };
  timeZone: string;
  /** `HH:mm`: the plant's production-day start (`useProductionDayStart`) */
  dayStart: string;
  /** receives the window of the chosen production days, each from `dayStart` to the next day's `dayStart` */
  onChange: (range: { from: string; to: string }) => void;
}

/**
 * Inclusive production days typed in the plant date format (QA PLA M1, Reports N1; owner decision 2026-10-19
 * "Production-day boundaries"): the fields show the window's days (the production days it touches when it is not whole days), and choosing
 * 17 → 17 gives the 06:00–06:00 production day — never midnight, never the current clock time of a rolling window.
 */
export function PlantDaysInput({ label, value, timeZone, dayStart, onChange, ...options }: PlantDaysInputProps) {
  const { start, end } = plantDaysOf(value, timeZone, dayStart);
  const shown = rangeFromDates({ start, end }, timeZone);
  const choose = (range: InstantRange) => {
    const next = rangeOfPlantDays(datesFromRange(range, timeZone), dayStart, timeZone);
    if (next.from && next.to) onChange({ from: next.from, to: next.to });
  };
  return <DateRangeInput label={label} value={shown} timeZone={timeZone} onChange={choose} textEntry {...options} />;
}
