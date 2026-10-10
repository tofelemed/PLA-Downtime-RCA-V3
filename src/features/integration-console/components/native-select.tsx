export interface NativeSelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
  disabled?: boolean;
  testId?: string;
  /** accessible name when no visible <label for> points at the select (table cells) */
  ariaLabel?: string;
}

/** Plain `<select>` styled like the inputs (keyboard and tablet friendly). */
export function NativeSelect({ id, value, onChange, options, placeholder, disabled, testId, ariaLabel }: NativeSelectProps) {
  return (
    <select
      id={id}
      data-testid={testId}
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
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
