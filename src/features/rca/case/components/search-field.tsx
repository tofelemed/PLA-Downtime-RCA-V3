import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface SearchFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** A toolbar search: its label stacked above an h-9 field (filter bar convention). */
export function SearchField({ id, label, value, onChange, placeholder }: SearchFieldProps) {
  return (
    <div className="flex w-full flex-col gap-1.5 sm:w-72">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="search" className="h-9" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
