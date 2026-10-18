import { Button } from '@/components/ui/button';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import { FormField } from '../components/form-field';
import { NativeSelect } from '../components/native-select';
import { PlantDateTimeField } from '../components/plant-date-time-field';
import type { PlanFormValues } from '../model/plan-form';
import type { FieldErrors } from '../model/profile-form';

type Rows = NonNullable<PlanFormValues['manualTargets']>;

export function ManualTargetsEditor({ rows, slices, timezone, errors, onChange }: { rows: Rows; slices: PlanFormValues['slices']; timezone: string; errors: FieldErrors; onChange: (rows: Rows) => void }) {
  const update = (index: number, patch: Partial<Rows[number]>) => onChange(rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  return <fieldset className="space-y-3" aria-label="Manual shift targets">
    <legend className="font-medium">Manual shift targets</legend>
    <p className="text-sm text-muted-foreground">Enter the exact start of each shift on the published calendar and the quantity in the profile unit. Unspecified shifts receive zero. Adding or removing a product slice clears these rows; re-enter the targets for the new slice list. The server validates shift matching and the header total when you preview or approve.</p>
    {errors.manualTargets && <p className="text-sm text-destructive">{errors.manualTargets}</p>}
    {rows.map((row, index) => <div key={index} className="grid items-end gap-3 rounded border p-3 sm:grid-cols-4">
      <FormField id={`manual-slice-${index}`} label="Product slice" error={errors[`manualTargets.${index}.slicePosition`]}>
        <NativeSelect id={`manual-slice-${index}`} value={String(row.slicePosition)} options={slices.map((_, i) => ({ value: String(i), label: `Slice ${i + 1}` }))} onChange={(value) => update(index, { slicePosition: Number(value) })} />
      </FormField>
      <PlantDateTimeField id={`manual-start-${index}`} label="Shift start" timezone={timezone} value={row.startLocal} error={errors[`manualTargets.${index}.utcStart`]} onChange={(startLocal) => update(index, { startLocal })} />
      <FormField id={`manual-quantity-${index}`} label="Shift target" error={errors[`manualTargets.${index}.target`]}>
        <DecimalInput id={`manual-quantity-${index}`} value={row.target} onChange={(target) => update(index, { target })} />
      </FormField>
      <Button type="button" variant="ghost" onClick={() => onChange(rows.filter((_, i) => i !== index))}>Remove target</Button>
    </div>)}
    <Button type="button" variant="outline" onClick={() => onChange([...rows, { slicePosition: 0, startLocal: '', target: null }])}>Add shift target</Button>
  </fieldset>;
}
