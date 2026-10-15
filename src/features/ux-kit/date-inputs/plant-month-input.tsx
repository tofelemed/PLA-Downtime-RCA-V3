import { useCalendarPreference, toDigits } from '@/lib/dates';
import { monthNames, parsePlantMonth, shiftPlantMonth } from '@/lib/dates';
import { NativeSelect } from '@/features/integration-console/components/native-select';

export interface PlantMonthInputProps {
  id: string;
  /** `YYYY-MM` in the plant calendar */
  value: string;
  /** the latest selectable month (the current plant month) */
  latest: string;
  onChange: (month: string) => void;
  /** months offered back from `latest` (default 24) */
  span?: number;
}

/**
 * A month of the plant calendar (Gregorian, or Jalali on a Persian plant), with the plant's digits; the
 * value stays the `YYYY-MM` string the server reads in the same calendar.
 */
export function PlantMonthInput({ id, value, latest, onChange, span = 24 }: PlantMonthInputProps) {
  const { calendar, digits } = useCalendarPreference();
  const names = monthNames(calendar);
  const months = Array.from({ length: span }, (_, i) => shiftPlantMonth(latest, i));
  if (!months.includes(value) && parsePlantMonth(value)) months.unshift(value);
  const options = months.map((month) => {
    const parsed = parsePlantMonth(month);
    const label = parsed ? `${names[parsed.month - 1]} ${toDigits(String(parsed.year), digits)}` : month;
    return { value: month, label };
  });
  return <NativeSelect id={id} value={value} options={options} onChange={(next) => onChange(next)} />;
}
