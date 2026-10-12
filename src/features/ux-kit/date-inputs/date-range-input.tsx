import { useEffect, useState } from 'react';
import type { CalendarSystem } from '@/lib/dates';
import {
  type InstantRange,
  type LocalDateRange,
  dateRangeError,
  datesFromRange,
  instantRangeError,
  rangeFromDates,
} from './date-input-model';
import { DateInput } from './date-input';
import { DateTimeInput } from './date-time-input';

/** Props of {@link DateRangeInput}: a half-open UTC range `[from, to)`. */
export interface DateRangeInputProps {
  label: string;
  value: InstantRange;
  /** plant IANA zone (never the browser zone) */
  timeZone: string;
  /** receives only ordered ranges; an open side is null */
  onChange: (range: InstantRange) => void;
  /** `date` (default): inclusive start/end days; `datetime`: start and end instants */
  mode?: 'date' | 'datetime';
  calendar?: CalendarSystem;
  disabled?: boolean;
}

/**
 * A period on the plant clock. In `date` mode the user picks inclusive days and the range emitted is
 * `[start of first day, start of the day after the last)`. Reversed ranges show an error and are not
 * emitted.
 */
export function DateRangeInput({ mode = 'date', ...props }: DateRangeInputProps) {
  return mode === 'datetime' ? <InstantRangeFields {...props} /> : <DateRangeFields {...props} />;
}

type FieldsProps = Omit<DateRangeInputProps, 'mode'>;

function DateRangeFields({ label, value, timeZone, onChange, calendar, disabled }: FieldsProps) {
  const [dates, setDates] = useState<LocalDateRange>(() => datesFromRange(value, timeZone));
  useEffect(() => {
    setDates((current) => {
      const emitted = rangeFromDates(current, timeZone);
      const same = emitted.from === value.from && emitted.to === value.to;
      return same ? current : datesFromRange(value, timeZone);
    });
  }, [value, timeZone]);

  const update = (next: LocalDateRange) => {
    setDates(next);
    if (!dateRangeError(next)) onChange(rangeFromDates(next, timeZone));
  };
  const error = dateRangeError(dates);
  const common = { calendar, disabled };
  return (
    <fieldset className="space-y-1" disabled={disabled}>
      <legend className="text-sm font-medium leading-none">{label}</legend>
      <div className="flex flex-wrap items-start gap-2">
        <DateInput label="From" value={dates.start} onChange={(start) => update({ ...dates, start })} {...common} />
        <DateInput
          label="To (inclusive)"
          value={dates.end}
          min={dates.start || undefined}
          error={error}
          onChange={(end) => update({ ...dates, end })}
          {...common}
        />
      </div>
    </fieldset>
  );
}

function InstantRangeFields({ label, value, timeZone, onChange, calendar, disabled }: FieldsProps) {
  const [range, setRange] = useState<InstantRange>(value);
  useEffect(() => {
    setRange((current) => (current.from === value.from && current.to === value.to ? current : value));
  }, [value]);

  const update = (next: InstantRange) => {
    setRange(next);
    if (!instantRangeError(next)) onChange(next);
  };
  const common = { timeZone, calendar, disabled };
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium leading-none">{label}</legend>
      <DateTimeInput label="From" value={range.from} onChange={(from) => update({ ...range, from })} {...common} />
      <DateTimeInput
        label="To"
        value={range.to}
        error={instantRangeError(range)}
        onChange={(to) => update({ ...range, to })}
        {...common}
      />
    </fieldset>
  );
}
