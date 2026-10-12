import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type CalendarSystem, useCalendarPreference } from '@/lib/dates';
import { describedBy } from './described-by';
import { FieldMessages } from './field-messages';
import { PersianDateField } from './persian-date-field';

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
}

/**
 * A date field in the tenant calendar: the native picker for Gregorian, a `YYYY/MM/DD` text field
 * for Jalali (`persian`). Always emits an ISO date, so models and payloads stay Gregorian.
 */
export function DateInput({ id, label, hideLabel = false, calendar, error, ...field }: DateInputProps) {
  const preference = useCalendarPreference();
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const shown = calendar ?? preference.calendar;
  const ariaLabel = hideLabel ? label : undefined;
  return (
    <div className="space-y-1">
      {!hideLabel && <Label htmlFor={inputId}>{label}</Label>}
      {shown === 'persian' ? (
        <PersianDateField id={inputId} ariaLabel={ariaLabel} error={error} {...field} />
      ) : (
        <NativeDateField id={inputId} ariaLabel={ariaLabel} error={error} {...field} />
      )}
    </div>
  );
}

type NativeDateFieldProps = Omit<DateInputProps, 'label' | 'hideLabel' | 'calendar' | 'id'> & {
  id: string;
  ariaLabel?: string;
};

function NativeDateField({ id, value, onChange, ariaLabel, error, ...rest }: NativeDateFieldProps) {
  const hintId = useId();
  const errorId = useId();
  const messages = { hintId, errorId, error };
  return (
    <div>
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
      <FieldMessages {...messages} />
    </div>
  );
}
