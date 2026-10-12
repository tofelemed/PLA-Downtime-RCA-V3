import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterSelectProps {
  /** accessible name, e.g. "Status filter" */
  label: string;
  value: string;
  options: readonly FilterOption[];
  onChange: (value: string) => void;
  className?: string;
}

/** Value of the "all" choice of a filter (Radix Select needs a non-empty value). */
export const ALL = 'all';

/** A labelled single-choice filter for list pages (the change drives a server query). */
export function FilterSelect({ label, value, options, onChange, className }: FilterSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className={cn('w-full sm:w-48', className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Options of a label map, with an "all" choice first. */
export function optionsOf(labels: Readonly<Record<string, string>>, allLabel: string): FilterOption[] {
  return [{ value: ALL, label: allLabel }, ...Object.entries(labels).map(([value, label]) => ({ value, label }))];
}
