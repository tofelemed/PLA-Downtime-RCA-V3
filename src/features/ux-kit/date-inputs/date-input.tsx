import { type ReactNode, useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type CalendarSystem, useCalendarPreference } from '@/lib/dates';
import { describedBy } from './described-by';
import { FieldMessages } from './field-messages';
import { RequiredMarker } from '../form-field';
import { PersianDateField } from './persian-date-field';
import { CalendarPopover } from './calendar-popover';
import { WithTrailing } from './with-trailing';

/** Opt-in calendar button beside the field (see {@link CalendarPopover}). */
export interface CalendarPickerOptions {
  /** defaults to the acting plant's week start */
  weekStart?: string | null;
  /** the date the calendar opens on while the field is empty */
  fallbackDate?: string;
}

/** Props of {@link DateInput}. Dates are ISO `YYYY-MM-DD` whatever calendar is shown. */
export interface DateInputProps {
  id?: string;
  label: string;
  /** shows `label` only to assistive technology (as `aria-label`) */
  hideLabel?: boolean;
  /** `YYYY-MM-DD` or `''` */
  value: string;
  /** receives `YYYY-MM-DD`, or `''` when cleared */
  onChange: (isoDate: string) => void;
  /** defaults to the tenant preference (`useCalendarPreference()`) */
  calendar?: CalendarSystem;
  /** inclusive ISO bounds */
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  /** an error owned by the caller, shown under the field */
  error?: string | null;
  /** typed in the plant date format in every calendar (the browser's native picker shows its own locale) */
  textEntry?: boolean;
  /** shows a calendar button that opens a month grid in the plant calendar */
  calendarPicker?: CalendarPickerOptions;
}

/**
 * A date field in the tenant calendar: the native picker for Gregorian, a `YYYY/MM/DD` text field
 * for Jalali (`persian`). Always emits an ISO date, so models and payloads stay Gregorian.
 */
export function DateInput({ id, label, hideLabel = false, calendar, error, textEntry = false, calendarPicker, ...field }: DateInputProps) {
  const preference = useCalendarPreference();
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const shown = calendar ?? preference.calendar;
  const ariaLabel = hideLabel ? label : undefined;
  const trailing = calendarPicker && (
    <CalendarPopover label={label} value={field.value} onSelect={field.onChange} calendar={shown} disabled={field.disabled} {...calendarPicker} />
  );
  return (
    <div className="space-y-1">
      {!hideLabel && <FieldLabel htmlFor={inputId} label={label} required={field.required} />}
      {shown === 'persian' || textEntry ? (
        <PersianDateField id={inputId} ariaLabel={ariaLabel} error={error} calendar={shown} trailing={trailing} {...field} />
      ) : (
        <NativeDateField id={inputId} ariaLabel={ariaLabel} error={error} trailing={trailing} {...field} />
      )}
    </div>
  );
}

function FieldLabel({ htmlFor, label, required }: { htmlFor: string; label: string; required?: boolean }) {
  return (
    <Label htmlFor={htmlFor}>
      {label}
      {required && <RequiredMarker />}
    </Label>
  );
}

type NativeDateFieldProps = Omit<DateInputProps, 'label' | 'hideLabel' | 'calendar' | 'id' | 'calendarPicker'> & {
  id: string;
  ariaLabel?: string;
  trailing?: ReactNode;
};

function NativeDateField({ id, value, onChange, ariaLabel, error, trailing, ...rest }: NativeDateFieldProps) {
  const hintId = useId();
  const errorId = useId();
  const messages = { hintId, errorId, error };
  return (
    <div>
      <WithTrailing trailing={trailing}>
        <Input
          id={id}
          type="date"
          value={value}
          aria-label={ariaLabel}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy(messages)}
          onChange={(event) => onChange(event.target.value)}
          {...rest}
        />
      </WithTrailing>
      <FieldMessages {...messages} />
    </div>
  );
}
