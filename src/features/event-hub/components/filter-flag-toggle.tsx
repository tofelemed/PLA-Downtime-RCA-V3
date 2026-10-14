import { Checkbox } from '@/components/ui/checkbox';

export interface FilterFlagToggleProps {
  id: string;
  label: string;
  /** what the server rule flags (shown on hover) */
  title: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** A yes/no list filter decided by a server rule (possible duplicates DT-04, possible repeats SME D5). */
export function FilterFlagToggle({ id, label, title, checked, onChange }: FilterFlagToggleProps) {
  return (
    <label className="flex items-center gap-2 text-sm" htmlFor={id} title={title}>
      <Checkbox id={id} data-testid={id} checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      {label}
    </label>
  );
}
