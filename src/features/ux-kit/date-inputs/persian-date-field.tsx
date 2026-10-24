import { type KeyboardEvent, type ReactNode, useEffect, useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useCalendarPreference, type CalendarSystem } from '@/lib/dates';
import { boundsError, dateToText, parseDateText } from './date-input-model';
import { describedBy } from './described-by';
import { FieldMessages } from './field-messages';
import { WithTrailing } from './with-trailing';

/** Props of {@link PersianDateField}: an ISO date in, an ISO date (or `''`) out. */
export interface PersianDateFieldProps {
  id: string;
  value: string;
  onChange: (isoDate: string) => void;
  ariaLabel?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  /** an error owned by the caller (e.g. a range out of order) */
  error?: string | null;
  /** `persian` (default) or `gregorian`: typed in the plant date format instead of the browser's picker */
  calendar?: CalendarSystem;
  /** shown after the input on the same line (e.g. a calendar button) */
  trailing?: ReactNode;
  /** a 36 px field, for toolbars where every control is h-9 */
  compact?: boolean;
}

/**
 * Text entry in the plant date format: Jalali `YYYY/MM/DD` (Latin or Persian digits, `/` or `-`) with the
 * Gregorian equivalent as a hint, or Gregorian `YYYY-MM-DD`. Parses on blur and Enter and keeps unreadable
 * text visible with an inline error.
 */
export function PersianDateField({ id, value, onChange, ariaLabel, min, max, disabled, required, error, calendar = 'persian', trailing, compact }: PersianDateFieldProps) {
  const { digits } = useCalendarPreference();
  const [text, setText] = useState(() => dateToText(value, calendar, digits));
  const [ownError, setOwnError] = useState<string | null>(null);
  const hintId = useId();
  const errorId = useId();

  useEffect(() => {
    setText(dateToText(value, calendar, digits));
    setOwnError(null);
  }, [value, calendar, digits]);

  const commit = () => {
    const parsed = parseDateText(text, calendar);
    const problem = parsed.error ?? boundsError(parsed.value, calendar, min, max);
    setOwnError(problem);
    if (problem) return;
    setText(dateToText(parsed.value, calendar, digits));
    if (parsed.value !== value) onChange(parsed.value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    }
  };

  const shownError = ownError ?? error ?? null;
  const hint = calendar === 'persian' && value && !ownError ? `Gregorian ${value}` : null;
  const messages = { hintId, hint, errorId, error: shownError };
  return (
    <div>
      <WithTrailing trailing={trailing}>
        <Input
          id={id}
          type="text"
          className={compact ? 'h-9' : undefined}
          inputMode="numeric"
          autoComplete="off"
          placeholder={calendar === 'persian' ? 'YYYY/MM/DD' : 'YYYY-MM-DD'}
          dir="ltr"
          value={text}
          aria-label={ariaLabel}
          aria-invalid={shownError !== null}
          aria-describedby={describedBy(messages)}
          aria-required={required || undefined}
          disabled={disabled}
          onChange={(event) => setText(event.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
        />
      </WithTrailing>
      <FieldMessages {...messages} />
    </div>
  );
}
