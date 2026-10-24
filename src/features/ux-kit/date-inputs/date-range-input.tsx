import { useEffect, useState } from 'react';
import { type CalendarSystem, utcToPlantLocal } from '@/lib/dates';
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
  /** `date` mode: days typed in the plant date format (see `DateInput.textEntry`) */
  textEntry?: boolean;
  /** `date` mode: label of the end field (default "To (inclusive)") */
  toLabel?: string;
  /** `date` mode: a calendar button beside each field (opt-in) */
  calendarPicker?: boolean;
  /** with `calendarPicker`: first day of the week; defaults to the acting plant's week start */
  weekStart?: string | null;
  /** `date` mode: the legend is read by assistive technology only (the fields keep "From" / "To") */
  hideLegend?: boolean;
  /**
   * `date` mode: the fields are toolbar items — h-9 controls, laid out as siblings of the toolbar's other
   * controls (the fieldset and its row take no box), so each wraps on its own. Implies `hideLegend`.
   */
  toolbar?: boolean;
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

const plantToday = (timeZone: string) => utcToPlantLocal(new Date().toISOString(), timeZone).slice(0, 10);

function DateRangeFields({ label, value, timeZone, onChange, calendar, disabled, textEntry, toLabel = 'To (inclusive)', hideLegend, toolbar, ...picker }: FieldsProps) {
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
  const common = { calendar, disabled, textEntry, compact: toolbar };
  const pickerOn = (other: string) =>
    picker.calendarPicker ? { calendarPicker: { weekStart: picker.weekStart, fallbackDate: other || plantToday(timeZone) } } : {};
  return (
    <fieldset className={toolbar ? 'contents' : 'space-y-1'} disabled={disabled}>
      <legend className={hideLegend || toolbar ? 'sr-only' : 'text-sm font-medium leading-none'}>{label}</legend>
      <div className={toolbar ? 'contents' : 'flex flex-wrap items-start gap-2'}>
        <DateInput label="From" value={dates.start} onChange={(start) => update({ ...dates, start })} {...common} {...pickerOn(dates.end)} />
        <DateInput
          label={toLabel}
          value={dates.end}
          min={dates.start || undefined}
          error={error}
          onChange={(end) => update({ ...dates, end })}
          {...common}
          {...pickerOn(dates.start)}
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
