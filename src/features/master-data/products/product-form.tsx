import type { FormEvent } from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PRODUCT_AVAILABILITY_LABELS } from '@/features/ux-kit/labels';
import type { ProductAvailability } from '../api/master-data-types';
import { FormActions } from '../components/form-actions';
import { LegacyValues } from '../components/legacy-values';
import { TextField } from '../components/text-field';
import type { FieldErrors } from '../model/field-errors';
import type { ProductDraft } from './product-form-model';

export interface ProductFormProps {
  draft: ProductDraft;
  errors: FieldErrors;
  onChange: (patch: Partial<ProductDraft>) => void;
  onSave: () => void;
  saving: boolean;
  /** the draft has unsaved edits */
  dirty?: boolean;
  isNew: boolean;
  readOnly: boolean;
}

const AVAILABILITY_HINT: Record<ProductAvailability, string> = {
  organization: 'Every plant of the organization sees this product. Production profiles and plans need a product of their own plant.',
  plant: 'Only this plant sees the product; it can be used in production profiles and plans.',
};

function AvailabilityField({ value, onChange, isNew }: { value: ProductAvailability; onChange: (v: ProductAvailability) => void; isNew: boolean }) {
  if (!isNew) {
    return (
      <p className="text-sm">
        <span className="text-muted-foreground">Available to: </span>
        {PRODUCT_AVAILABILITY_LABELS[value]}
        <span className="block text-xs text-muted-foreground">{AVAILABILITY_HINT[value]}</span>
      </p>
    );
  }
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Available to</legend>
      <RadioGroup value={value} onValueChange={(next) => onChange(next as ProductAvailability)}>
        {(Object.keys(PRODUCT_AVAILABILITY_LABELS) as ProductAvailability[]).map((option) => (
          <div key={option} className="flex items-start gap-2">
            <RadioGroupItem id={`availability-${option}`} value={option} className="mt-0.5" />
            <Label htmlFor={`availability-${option}`} className="font-normal">
              {PRODUCT_AVAILABILITY_LABELS[option]}
              <span className="block text-xs text-muted-foreground">{AVAILABILITY_HINT[option]}</span>
            </Label>
          </div>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

/** Name, code, unit of measure, description, who can use it, and the folded legacy standard cost. */
export function ProductForm({ draft, errors, onChange, onSave, saving, dirty, isNew, readOnly }: ProductFormProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave();
  };
  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4" noValidate aria-label={isNew ? 'Create product' : 'Edit product'}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="name" label="Name" value={draft.name} onChange={(name) => onChange({ name })} error={errors.name} required disabled={readOnly} />
        <TextField id="code" label="Code" value={draft.code} onChange={(code) => onChange({ code })} error={errors.code} hint="Unique across the organization's products." required disabled={readOnly} />
      </div>
      <TextField id="uom" label="Unit of measure" value={draft.uom} onChange={(uom) => onChange({ uom })} placeholder="e.g. t" disabled={readOnly} />
      <TextField id="description" label="Description" value={draft.description} onChange={(description) => onChange({ description })} multiline disabled={readOnly} />
      <AvailabilityField value={draft.availability} onChange={(availability) => onChange({ availability })} isNew={isNew} />
      <LegacyValues>
        <TextField
          id="legacyStandardCost"
          label="Standard cost (unconfirmed)"
          value={draft.legacyStandardCost}
          onChange={(legacyStandardCost) => onChange({ legacyStandardCost })}
          error={errors.legacyStandardCost}
          inputMode="decimal"
          disabled={readOnly}
        />
      </LegacyValues>
      {!readOnly && <FormActions isNew={isNew} saving={saving} dirty={dirty} cancelTo="/master-data/products" />}
    </form>
  );
}
