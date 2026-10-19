import { plantLocalToUtc, utcToPlantLocal } from '@/lib/dates';
import { DateTimeInput } from '@/features/ux-kit/date-inputs';

export interface PlantDateTimeFieldProps {
  /** wrapper test id suffix (`field-<id>`) */
  id: string;
  label: string;
  /** plant wall-clock `YYYY-MM-DDTHH:mm`, or '' (the forms' model) */
  value: string;
  timezone: string;
  onChange: (local: string) => void;
  error?: string;
  disabled?: boolean;
  /** shows the required marker and marks the date and time inputs required */
  required?: boolean;
}

/**
 * The shared date + time input (tenant calendar, plant clock) for the planning forms, whose models keep
 * plant-local `YYYY-MM-DDTHH:mm` text: the value goes in and comes back through the DST-safe plant-zone
 * conversion, so a Persian-calendar plant enters `1405/07/20 06:00` and the model still gets ISO text.
 */
export function PlantDateTimeField({ id, label, value, timezone, onChange, error, disabled, required }: PlantDateTimeFieldProps) {
  const iso = value ? plantLocalToUtc(value, timezone) : null;
  return (
    <div data-testid={`field-${id}`}>
      <DateTimeInput
        label={label}
        value={iso}
        timeZone={timezone}
        disabled={disabled}
        required={required}
        error={error ?? null}
        onChange={(next) => onChange(next ? utcToPlantLocal(next, timezone) : '')}
      />
    </div>
  );
}
