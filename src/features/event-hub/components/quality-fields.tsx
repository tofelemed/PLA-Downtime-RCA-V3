import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DISPOSITION_CLASS_LABELS, EVENT_DISPOSITION_CLASSES } from '@/features/ux-kit/disposition-labels';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import type { EventFormField, EventFormValues, FieldErrors } from '../model/event-form';

const SELECT_CLASS = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';

interface QualityForm {
  values: EventFormValues;
  errors: FieldErrors;
  setField: (field: EventFormField, value: string) => void;
}

function Message({ text }: { text?: string }) {
  return text ? <p className="text-xs text-destructive">{text}</p> : null;
}

/**
 * SME E3: how much product a quality loss affected and what happened to it — sold as a downgrade at a
 * discount, scrapped, or sent to rework. A later recovery of reworked material is recorded on the lot
 * disposition, never by raising good output here. Output and measured slowdown share the quantity controls.
 */
export function QualityFields({ form }: { form: QualityForm }) {
  const { values, errors, setField } = form;
  if (!['quality_loss', 'production_output', 'slowdown'].includes(values.physicalType)) return null;
  return (
    <fieldset className="grid gap-3 rounded-md border p-3 sm:col-span-2 sm:grid-cols-3" data-testid="quality-fields">
      <legend className="px-1 text-sm font-medium">{values.physicalType === 'quality_loss' ? 'Off-spec product' : values.physicalType === 'production_output' ? 'Production output' : 'Slowdown loss'}</legend>
      {values.physicalType === 'slowdown' && <p className="text-xs text-muted-foreground sm:col-span-3">Enter either measured lost quantity with its unit or Output lost (%). The server attributes it within the computed performance loss.</p>}
      <div className="space-y-1">
        <Label htmlFor="quantity">{values.physicalType === 'slowdown' ? 'Lost quantity (optional when output loss % is given)' : 'Quantity'}</Label>
        <DecimalInput id="quantity" value={values.quantity} onChange={(v) => setField('quantity', v ?? '')} />
        <Message text={errors.quantity} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="quantityUom">Unit</Label>
        <Input id="quantityUom" value={values.quantityUom} maxLength={32} placeholder="t" onChange={(e) => setField('quantityUom', e.target.value)} />
        <Message text={errors.quantityUom} />
      </div>
      {values.physicalType === 'quality_loss' && <div className="space-y-1">
        <Label htmlFor="dispositionClass">Disposition</Label>
        <select id="dispositionClass" className={SELECT_CLASS} value={values.dispositionClass} onChange={(e) => setField('dispositionClass', e.target.value)}>
          <option value="">— not decided yet —</option>
          {EVENT_DISPOSITION_CLASSES.map((value) => (
            <option key={value} value={value}>{DISPOSITION_CLASS_LABELS[value]}</option>
          ))}
        </select>
        <Message text={errors.dispositionClass} />
      </div>}
    </fieldset>
  );
}
