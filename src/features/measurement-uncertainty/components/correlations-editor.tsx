import { Button } from '@/components/ui/button';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import { COMPONENT_KIND_LABELS, type ComponentRow, type CorrelationRow } from '../model/budget-form';

const SELECT = 'h-9 rounded-md border border-input bg-background px-2 text-sm';

interface CorrelationsEditorProps {
  rows: CorrelationRow[];
  components: ComponentRow[];
  onChange: (rows: CorrelationRow[]) => void;
}

/** Optional correlation coefficients r between two components (independent when none is stated). */
export function CorrelationsEditor({ rows, components, onChange }: CorrelationsEditorProps) {
  const update = (index: number, patch: Partial<CorrelationRow>) => onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const name = (i: number) => components[i]?.label.trim() || `${COMPONENT_KIND_LABELS[components[i]?.kind ?? 'meter']} ${i + 1}`;
  const choose = (value: number, onPick: (n: number) => void, label: string) => (
    <select aria-label={label} className={SELECT} value={value} onChange={(e) => onPick(Number(e.target.value))}>
      {components.map((_, i) => <option key={i} value={i}>{name(i)}</option>)}
    </select>
  );
  return (
    <fieldset className="space-y-2" data-testid="budget-correlations">
      <legend className="text-sm font-medium">Correlations (optional; components are independent unless stated)</legend>
      {rows.map((row, index) => (
        <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_7rem_auto]">
          {choose(row.a, (a) => update(index, { a }), 'First component')}
          {choose(row.b, (b) => update(index, { b }), 'Second component')}
          <DecimalInput aria-label="Correlation coefficient" placeholder="r" allowNegative value={row.coefficient} onChange={(v) => update(index, { coefficient: v })} />
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(rows.filter((_, i) => i !== index))}>
            Remove
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" disabled={components.length < 2} onClick={() => onChange([...rows, { a: 0, b: 1, coefficient: null }])}>
        Add correlation
      </Button>
    </fieldset>
  );
}
