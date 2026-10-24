import { DateTimeInput } from '@/features/ux-kit/date-inputs';
import { plantLocalToUtc, utcToPlantLocal } from '@/lib/dates';

export interface FlowDateTimeFieldProps {
  /** wrapper test id suffix (`field-<id>`) */
  id: string;
  label: string;
  /** plant wall-clock `YYYY-MM-DDTHH:mm`, or '' (the plant-flow form models) */
  value: string;
  timezone: string;
  onChange: (local: string) => void;
  error?: string;
}

/**
 * Date + time on the plant clock for the plant-flow dialogs: the compact (h-9) `DateTimeInput`, its value
 * converted DST-safely between the models' plant-local text and UTC (as `PlantDateTimeField` does).
 */
export function FlowDateTimeField({ id, label, value, timezone, onChange, error }: FlowDateTimeFieldProps) {
  const iso = value ? plantLocalToUtc(value, timezone) : null;
  return (
    <div data-testid={`field-${id}`}>
      <DateTimeInput
        label={label}
        value={iso}
        timeZone={timezone}
        error={error ?? null}
        compact
        onChange={(next) => onChange(next ? utcToPlantLocal(next, timezone) : '')}
      />
    </div>
  );
}
