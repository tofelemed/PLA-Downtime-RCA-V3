import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface ChoiceFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** value → label */
  options: ReadonlyArray<{ value: string; label: string }>;
  disabled?: boolean;
}

/**
 * A labelled select of fixed choices. A stored value that is not among the choices (legacy data such as
 * "Operational") stays selectable, so opening and saving a record never changes it silently.
 */
export function ChoiceField({ id, label, value, onChange, options, disabled }: ChoiceFieldProps) {
  const all = value && !options.some((option) => option.value === value) ? [{ value, label: value }, ...options] : options;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id}>
          <SelectValue placeholder="Not set" />
        </SelectTrigger>
        <SelectContent>
          {all.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
