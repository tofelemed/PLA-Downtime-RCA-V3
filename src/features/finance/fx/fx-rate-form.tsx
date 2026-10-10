import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateFxRate } from '@/api/v2/queries/valuation';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import { FormField } from '@/features/plans-profiles-calendars/components/form-field';
import { NativeSelect } from '@/features/plans-profiles-calendars/components/native-select';
import { RefusalNotice } from '@/features/plans-profiles-calendars/components/refusal-notice';
import type { FieldErrors } from '@/features/plans-profiles-calendars/model/profile-form';
import { refusalOf } from '@/features/plans-profiles-calendars/model/refusal';
import { emptyFxForm, fxCreateBody, FX_SCALE, validateFxForm, type FxFormValues } from '../model/fx-form';
import { REPORTING_CURRENCIES } from '../model/policy-form';

const CURRENCIES = REPORTING_CURRENCIES.map((code) => ({ value: code, label: code }));

export interface FxRateFormProps {
  timezone: string;
  onDone: () => void;
}

/** A draft FX rate version; the server validates the shape again and decides overlaps at approval. */
export function FxRateForm({ timezone, onDone }: FxRateFormProps) {
  const [values, setValues] = useState<FxFormValues>(emptyFxForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const create = useCreateFxRate();
  const set = <K extends keyof FxFormValues>(key: K, value: FxFormValues[K]) => setValues((prev) => ({ ...prev, [key]: value }));
  const fieldError = (key: string) => errors[key] ?? refusalOf(create.error)?.fieldErrors[key];

  const save = async () => {
    const found = validateFxForm(values, timezone);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const saved = await create.submit(fxCreateBody(values, timezone)).catch(() => null);
    if (saved) onDone();
  };

  return (
    <div className="space-y-2 rounded-md border p-3" data-testid="fx-form">
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <FormField id="fromCurrency" label="From (1 unit of)" error={fieldError('fromCurrency')}>
          <NativeSelect id="fromCurrency" value={values.fromCurrency} options={CURRENCIES} onChange={(v) => set('fromCurrency', v)} />
        </FormField>
        <FormField id="toCurrency" label="To" error={fieldError('toCurrency')}>
          <NativeSelect id="toCurrency" value={values.toCurrency} options={CURRENCIES} onChange={(v) => set('toCurrency', v)} />
        </FormField>
        <FormField id="rate" label={`Rate (${values.toCurrency} per 1 ${values.fromCurrency})`} error={fieldError('rate')}>
          <DecimalInput id="rate" value={values.rate} scale={FX_SCALE} onChange={(v) => set('rate', v)} aria-label="Rate" />
        </FormField>
        <FormField id="fxEffectiveFrom" label={`From (${timezone})`} error={fieldError('effectiveFrom')}>
          <Input id="fxEffectiveFrom" type="datetime-local" value={values.effectiveFrom} onChange={(e) => set('effectiveFrom', e.target.value)} />
        </FormField>
        <FormField id="fxEffectiveTo" label="To (optional, exclusive)" error={fieldError('effectiveTo')}>
          <Input id="fxEffectiveTo" type="datetime-local" value={values.effectiveTo} onChange={(e) => set('effectiveTo', e.target.value)} />
        </FormField>
        <FormField id="fxSource" label="Source (optional)" error={fieldError('source')}>
          <Input id="fxSource" value={values.source} placeholder="e.g. central bank" onChange={(e) => set('source', e.target.value)} />
        </FormField>
      </div>
      <RefusalNotice error={create.error} timezone={timezone} />
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={create.isPending} data-testid="fx-save">
          Save draft
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
