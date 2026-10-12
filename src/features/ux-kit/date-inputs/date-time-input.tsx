import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import type { CalendarSystem } from '@/lib/dates';
import { type LocalDateTime, joinInstant, splitInstant } from './date-input-model';
import { DateInput } from './date-input';

/** Props of {@link DateTimeInput}: a UTC instant shown and entered on the plant clock. */
export interface DateTimeInputProps {
  label: string;
  /** ISO UTC instant or null */
  value: string | null;
  /** plant IANA zone (never the browser zone) */
  timeZone: string;
  /** receives an ISO UTC instant (`toISOString()` form), or null when the date is cleared */
  onChange: (isoUtc: string | null) => void;
  calendar?: CalendarSystem;
  disabled?: boolean;
  required?: boolean;
  /** an error owned by the caller, shown under the date */
  error?: string | null;
}

/**
 * Date (tenant calendar) plus 24-hour time on the plant clock, converted DST-safely to UTC.
 * Picking a date without a time means 00:00.
 */
export function DateTimeInput({ label, value, timeZone, onChange, calendar, disabled, required, error }: DateTimeInputProps) {
  const [local, setLocal] = useState<LocalDateTime>(() => splitInstant(value, timeZone));

  useEffect(() => {
    setLocal((current) => (joinInstant(current, timeZone) === value ? current : splitInstant(value, timeZone)));
  }, [value, timeZone]);

  const update = (next: LocalDateTime) => {
    const filled = next.date && !next.time ? { ...next, time: '00:00' } : next;
    setLocal(filled);
    const instant = joinInstant(filled, timeZone);
    if (instant !== value) onChange(instant);
  };

  return (
    <fieldset className="space-y-1" disabled={disabled}>
      <legend className="text-sm font-medium leading-none">{label}</legend>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-[10rem] flex-1">
          <DateInput
            label={`${label} date`}
            hideLabel
            value={local.date}
            calendar={calendar}
            disabled={disabled}
            required={required}
            error={error}
            onChange={(date) => update({ date, time: date ? local.time : '' })}
          />
        </div>
        <Input
          type="time"
          className="w-[8rem]"
          aria-label={`${label} time`}
          value={local.time}
          disabled={disabled || !local.date}
          required={required}
          onChange={(event) => update({ ...local, time: event.target.value })}
        />
      </div>
    </fieldset>
  );
}
