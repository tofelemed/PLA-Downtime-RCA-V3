import { Button } from '@/components/ui/button';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import { ActionIcon } from '@/lib/icons';
import { FormField } from '../components/form-field';
import { NativeSelect, type Option } from '../components/native-select';
import { PlantDateTimeField } from '../components/plant-date-time-field';
import { emptySlice, type SliceRow } from '../model/plan-form';
import type { FieldErrors } from '../model/profile-form';

export interface SlicesEditorProps {
  rows: SliceRow[];
  productOptions: Option[];
  errors: FieldErrors;
  timezone: string;
  onChange: (rows: SliceRow[]) => void;
}

interface SliceRowEditorProps extends Omit<SlicesEditorProps, 'rows' | 'onChange'> {
  row: SliceRow;
  index: number;
  canRemove: boolean;
  update: (patch: Partial<SliceRow>) => void;
  remove: () => void;
}

function SliceRowEditor({ row, index, productOptions, errors, timezone, canRemove, update, remove }: SliceRowEditorProps) {
  const n = index + 1;
  return (
    <div className="space-y-2 rounded-md border p-3" data-testid="slice-row">
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField id={`slice-${index}-product`} label={`Product of slice ${n}`} error={errors[`slices.${index}.productId`]}>
          <NativeSelect id={`slice-${index}-product`} value={row.productId} options={productOptions} placeholder="Choose a product" invalid={!!errors[`slices.${index}.productId`]} onChange={(v) => update({ productId: v })} />
        </FormField>
        <FormField id={`slice-${index}-weight`} label="Weight (explicit-weight distribution)" error={errors[`slices.${index}.weight`]}>
          <DecimalInput id={`slice-${index}-weight`} aria-label={`Weight of slice ${n}`} value={row.weight} onChange={(v) => update({ weight: v })} />
        </FormField>
        <FormField id={`slice-${index}-target`} label="Slice target (replaces the header target)" error={errors[`slices.${index}.target`]}>
          <DecimalInput id={`slice-${index}-target`} aria-label={`Target of slice ${n}`} value={row.target} onChange={(v) => update({ target: v })} />
        </FormField>
        <PlantDateTimeField id={`slice-${index}-from`} label={`Campaign start of slice ${n}`} value={row.campaignFrom} timezone={timezone} error={errors[`slices.${index}.campaignFrom`]} onChange={(v) => update({ campaignFrom: v })} />
        <PlantDateTimeField id={`slice-${index}-to`} label={`Campaign end of slice ${n}`} value={row.campaignTo} timezone={timezone} error={errors[`slices.${index}.campaignTo`]} onChange={(v) => update({ campaignTo: v })} />
        <div className="flex items-end">
          <Button type="button" size="sm" variant="ghost" disabled={!canRemove} onClick={remove}>
            <ActionIcon.remove className="h-4 w-4" aria-hidden="true" />
            Remove slice {n}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Product slices as sequential campaigns (concurrent products stay off on the server). Empty campaign
 * bounds = the whole plan window; weights apply to explicit-weight distribution; a slice target replaces
 * the header target for that slice.
 */
export function SlicesEditor({ rows, productOptions, errors, timezone, onChange }: SlicesEditorProps) {
  const update = (index: number, patch: Partial<SliceRow>) => onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <fieldset className="space-y-3" data-testid="slices">
      <legend className="sr-only">Product slices (sequential campaigns)</legend>
      {errors.slices && <p className="text-xs text-destructive">{errors.slices}</p>}
      {rows.map((row, index) => (
        <SliceRowEditor
          key={index}
          row={row}
          index={index}
          productOptions={productOptions}
          errors={errors}
          timezone={timezone}
          canRemove={rows.length > 1}
          update={(patch) => update(index, patch)}
          remove={() => onChange(rows.filter((_, i) => i !== index))}
        />
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...rows, emptySlice()])}>
        <ActionIcon.add className="h-4 w-4" aria-hidden="true" />
        Add slice
      </Button>
    </fieldset>
  );
}
