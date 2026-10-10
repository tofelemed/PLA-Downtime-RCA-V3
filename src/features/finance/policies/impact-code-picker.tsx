import { useCodeList } from '@/api/v2/queries/codes-admin';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export interface ImpactCodePickerProps {
  selected: readonly string[];
  onChange: (ids: string[]) => void;
}

/**
 * Impact codes whose time cost is an independent cost component (VAL02 `independent_components`): only
 * these may be summed with lost margin. The tenant's own codes (the server refuses others: 422).
 */
export function ImpactCodePicker({ selected, onChange }: ImpactCodePickerProps) {
  const codes = useCodeList('impact-codes');
  if (codes.isLoading) return <p className="text-xs text-muted-foreground">Loading impact codes…</p>;
  if (codes.items.length === 0) return <p className="text-xs text-muted-foreground">This plant has no impact codes.</p>;
  const toggle = (id: string, on: boolean) => onChange(on ? [...selected, id] : selected.filter((entry) => entry !== id));
  return (
    <fieldset className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2" data-testid="impact-code-picker">
      <legend className="px-1 text-xs">Independent cost components</legend>
      {codes.items.map((code) => (
        <div key={code.id} className="flex items-center gap-2">
          <Checkbox id={`impact-${code.id}`} checked={selected.includes(code.id)} onCheckedChange={(checked) => toggle(code.id, checked === true)} />
          <Label htmlFor={`impact-${code.id}`} className="text-xs">
            {code.code} — {code.name}
          </Label>
        </div>
      ))}
    </fieldset>
  );
}
