export const SELECT_CLASS = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';

export interface Option {
  value: string;
  label: string;
}

export interface NativeSelectProps {
  id: string;
  value: string;
  options: readonly Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** accessible name when no visible `<label for>` points at the select */
  ariaLabel?: string;
  /** set by the enclosing `FormField` (required marker, hint / error ids) */
  'aria-required'?: boolean;
  'aria-describedby'?: string;
}

/** Plain `<select>` (keyboard- and test-friendly, as in the 3.2 / 3.3 screens). */
export function NativeSelect({ id, value, options, onChange, placeholder, disabled, invalid, ariaLabel, ...aria }: NativeSelectProps) {
  return (
    <select
      id={id}
      className={SELECT_CLASS}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      aria-required={aria['aria-required']}
      aria-describedby={aria['aria-describedby'] ?? (invalid ? `${id}-error` : undefined)}
      onChange={(event) => onChange(event.target.value)}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
