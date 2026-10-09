import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import { NativeSelect, type Option } from '../components/native-select';
import { emptySlice, type SliceRow } from '../model/plan-form';
import type { FieldErrors } from '../model/profile-form';

export interface SlicesEditorProps {
  rows: SliceRow[];
  productOptions: Option[];
  errors: FieldErrors;
  timezone: string;
  onChange: (rows: SliceRow[]) => void;
}

/**
 * Product slices as sequential campaigns (D14: concurrent products stay behind the server flag). Empty
 * campaign bounds = the whole plan window; weights apply to explicit-weight distribution; a slice target
 * replaces the header target for that slice.
 */
export function SlicesEditor({ rows, productOptions, errors, timezone, onChange }: SlicesEditorProps) {
  const update = (index: number, patch: Partial<SliceRow>) => onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <fieldset className="space-y-2" data-testid="slices">
      <legend className="text-sm font-medium">Product slices (sequential campaigns, {timezone})</legend>
      {errors.slices && <p className="text-xs text-destructive">{errors.slices}</p>}
      {rows.map((row, index) => (
        <div key={index} className="space-y-1" data-testid="slice-row">
          <div className="grid grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))_auto] items-start gap-2">
            <NativeSelect
              id={`slice-${index}-product`}
              value={row.productId}
              options={productOptions}
              placeholder="Product"
              invalid={!!errors[`slices.${index}.productId`]}
              onChange={(v) => update(index, { productId: v })}
            />
            <Input type="datetime-local" aria-label={`Campaign start of slice ${index + 1}`} value={row.campaignFrom} onChange={(e) => update(index, { campaignFrom: e.target.value })} />
            <Input type="datetime-local" aria-label={`Campaign end of slice ${index + 1}`} value={row.campaignTo} onChange={(e) => update(index, { campaignTo: e.target.value })} />
            <DecimalInput aria-label={`Weight of slice ${index + 1}`} placeholder="Weight" value={row.weight} onChange={(v) => update(index, { weight: v })} />
            <DecimalInput aria-label={`Target of slice ${index + 1}`} placeholder="Slice target" value={row.target} onChange={(v) => update(index, { target: v })} />
            <Button type="button" size="sm" variant="ghost" disabled={rows.length === 1} onClick={() => onChange(rows.filter((_, i) => i !== index))}>
              Remove
            </Button>
          </div>
          {Object.entries(errors)
            .filter(([field]) => field.startsWith(`slices.${index}.`))
            .map(([field, message]) => (
              <p key={field} id={`slice-${index}-product-error`} className="text-xs text-destructive">
                {message}
              </p>
            ))}
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...rows, emptySlice()])}>
        Add slice
      </Button>
    </fieldset>
  );
}
