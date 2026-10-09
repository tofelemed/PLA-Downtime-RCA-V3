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
}

/** Plain `<select>` (keyboard- and test-friendly, as in the 3.2 / 3.3 screens). */
export function NativeSelect({ id, value, options, onChange, placeholder, disabled, invalid }: NativeSelectProps) {
  return (
    <select
      id={id}
      className={SELECT_CLASS}
      value={value}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${id}-error` : undefined}
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
