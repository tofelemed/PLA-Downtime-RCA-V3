import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export interface FilterToggleProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** A yes / no filter of a filter row: h-9, so it lines up on the row's bottom edge with the labelled selects. */
export function FilterToggle({ id, label, checked, onChange }: FilterToggleProps) {
  return (
    <div className="flex h-9 items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(next) => onChange(next === true)} />
      <Label htmlFor={id} className="whitespace-nowrap text-sm">
        {label}
      </Label>
    </div>
  );
}
