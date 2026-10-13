import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type PickableCode, reasonCodeOptions } from './reason-code-options';

export interface ReasonCodePickerProps {
  id: string;
  codes: readonly PickableCode[];
  value: string;
  onChange: (reasonCodeId: string) => void;
  label?: string;
  /** text of the empty choice; null = no empty choice */
  emptyLabel?: string | null;
  disabled?: boolean;
  error?: string;
}

/**
 * FE-04: one reason-code picker for every screen — a search box over code, name and parents, and a
 * native select (keyboard and tablet friendly, UX07) of the matching leaf codes with their path.
 */
export function ReasonCodePicker({ id, codes, value, onChange, label = 'Reason code', emptyLabel = '— none —', disabled, error }: ReasonCodePickerProps) {
  const [query, setQuery] = useState('');
  const options = reasonCodeOptions(codes, query, value || null);
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        type="search"
        aria-label="Search reason codes"
        placeholder="Search code, name or group…"
        value={query}
        disabled={disabled}
        onChange={(event) => setQuery(event.target.value)}
        className="h-8"
      />
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
      >
        {emptyLabel !== null && <option value="">{emptyLabel}</option>}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {query && options.length === 0 && <p className="text-xs text-muted-foreground">No reason code matches “{query}”.</p>}
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
