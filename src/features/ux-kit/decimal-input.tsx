import { useEffect, useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { MAX_SCALE, parseDecimalInput } from './format/decimal';

export interface DecimalInputProps {
  /** canonical decimal string (or null when empty) — never a JS number */
  value: string | null;
  onChange: (value: string | null) => void;
  /** every keystroke's raw text, valid or not (e.g. so an unsaved-changes guard sees invalid typing too) */
  onTextChange?: (text: string) => void;
  scale?: number;
  allowNegative?: boolean;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

/**
 * String-based decimal entry (plan 3.1): up to `scale` (8) fraction digits, no float conversion, so
 * what the user types is exactly what the API receives. Invalid text stays visible with its error and
 * does not reach `onChange`.
 */
export function DecimalInput({ value, onChange, onTextChange, scale = MAX_SCALE, allowNegative = false, ...rest }: DecimalInputProps) {
  const [text, setText] = useState(value ?? '');
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  useEffect(() => {
    if (parseDecimalInput(text, scale, allowNegative).value !== value) setText(value ?? '');
    // only an outside change of `value` resets the text
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (next: string) => {
    setText(next);
    onTextChange?.(next);
    const parsed = parseDecimalInput(next, scale, allowNegative);
    setError(parsed.error);
    if (!parsed.error) onChange(parsed.value);
  };

  return (
    <div>
      <Input
        {...rest}
        inputMode="decimal"
        value={text}
        aria-invalid={error !== null}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => handleChange(event.target.value)}
      />
      {error && (
        <p id={errorId} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
