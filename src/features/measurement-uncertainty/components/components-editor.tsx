import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import { COMPONENT_KIND_LABELS, COMPONENT_KINDS, emptyComponent, type ComponentRow } from '../model/budget-form';

const SELECT = 'h-9 rounded-md border border-input bg-background px-2 text-sm';

interface ComponentsEditorProps {
  rows: ComponentRow[];
  uom: string;
  onChange: (rows: ComponentRow[]) => void;
}

/** The budget's input quantities: kind, name, standard uncertainty u and sensitivity c (1 when empty). */
export function ComponentsEditor({ rows, uom, onChange }: ComponentsEditorProps) {
  const update = (index: number, patch: Partial<ComponentRow>) => onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <fieldset className="space-y-2" data-testid="budget-components">
      <legend className="text-sm font-medium">Components (standard uncertainty, one standard deviation, in {uom || 'the budget unit'})</legend>
      {rows.map((row, index) => (
        <div key={index} className="grid gap-2 sm:grid-cols-[10rem_1fr_8rem_7rem_auto]" data-testid="budget-component">
          <select aria-label="Kind" className={SELECT} value={row.kind} onChange={(e) => update(index, { kind: e.target.value as ComponentRow['kind'] })}>
            {COMPONENT_KINDS.map((kind) => <option key={kind} value={kind}>{COMPONENT_KIND_LABELS[kind]}</option>)}
          </select>
          <Input aria-label="Name" placeholder="e.g. FT-101 totalizer" maxLength={200} value={row.label} onChange={(e) => update(index, { label: e.target.value })} />
          <DecimalInput aria-label="Standard uncertainty" placeholder="u" value={row.standardUncertainty} onChange={(v) => update(index, { standardUncertainty: v })} />
          <DecimalInput aria-label="Sensitivity" placeholder="c = 1" allowNegative value={row.sensitivity} onChange={(v) => update(index, { sensitivity: v })} />
          <Button type="button" size="sm" variant="ghost" disabled={rows.length === 1} onClick={() => onChange(rows.filter((_, i) => i !== index))}>
            Remove
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...rows, emptyComponent()])} data-testid="budget-add-component">
        Add component
      </Button>
    </fieldset>
  );
}
