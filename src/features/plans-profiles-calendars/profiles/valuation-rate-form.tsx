import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateValuationRate } from '@/api/v2/queries/profile-commands';
import type { ValuationBasis } from '@/api/v2/types/profiles';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import { FormField } from '../components/form-field';
import { NativeSelect } from '../components/native-select';
import { RefusalNotice } from '../components/refusal-notice';
import { validateValuationForm, valuationCreateBody, type FieldErrors, type ValuationFormValues } from '../model/profile-form';
import { refusalOf } from '../model/refusal';

/** Bases a profile owns (per quantity); cost per hour belongs to impact codes (3.8). */
const BASES = [
  { value: 'contribution_margin', label: 'Contribution margin' },
  { value: 'standard_cost', label: 'Standard cost' },
];
/** D08 Q2: rates are entered in IRR or USD (the server refuses others: CURRENCY_NOT_REPORTED). */
const CURRENCIES = [
  { value: 'IRR', label: 'IRR' },
  { value: 'USD', label: 'USD' },
];

export interface ValuationRateFormProps {
  profileId: string;
  uom: string | null;
  timezone: string;
  onDone: () => void;
}

export function ValuationRateForm({ profileId, uom, timezone, onDone }: ValuationRateFormProps) {
  const [values, setValues] = useState<ValuationFormValues>({ basis: 'contribution_margin', value: null, currency: 'IRR', effectiveFrom: '', effectiveTo: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const create = useCreateValuationRate();
  const set = <K extends keyof ValuationFormValues>(key: K, value: ValuationFormValues[K]) => setValues((prev) => ({ ...prev, [key]: value }));
  const fieldError = (key: string) => errors[key] ?? refusalOf(create.error)?.fieldErrors[key];

  const save = async () => {
    const found = validateValuationForm(values, timezone);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const saved = await create.submit(valuationCreateBody(profileId, values, timezone)).catch(() => null);
    if (saved) onDone();
  };

  return (
    <div className="space-y-2 rounded-md border p-3" data-testid="valuation-form">
      <div className="grid gap-2 sm:grid-cols-5">
        <FormField id="basis" label="Basis">
          <NativeSelect id="basis" value={values.basis} options={BASES} onChange={(v) => set('basis', v as ValuationBasis)} />
        </FormField>
        <FormField id="value" label={`Value per ${uom ?? 'unit unknown'}`} error={fieldError('value')}>
          <DecimalInput id="value" value={values.value} onChange={(v) => set('value', v)} aria-label="Value" />
        </FormField>
        <FormField id="currency" label="Currency" error={fieldError('currency')}>
          <NativeSelect id="currency" value={values.currency} options={CURRENCIES} onChange={(v) => set('currency', v)} />
        </FormField>
        <FormField id="valEffectiveFrom" label={`From (${timezone})`} error={fieldError('effectiveFrom')}>
          <Input id="valEffectiveFrom" type="datetime-local" value={values.effectiveFrom} onChange={(e) => set('effectiveFrom', e.target.value)} />
        </FormField>
        <FormField id="valEffectiveTo" label="To (optional)" error={fieldError('effectiveTo')}>
          <Input id="valEffectiveTo" type="datetime-local" value={values.effectiveTo} onChange={(e) => set('effectiveTo', e.target.value)} />
        </FormField>
      </div>
      <RefusalNotice error={create.error} timezone={timezone} />
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={create.isPending}>
          Add draft valuation rate
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
