import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateFxRate } from '@/api/v2/queries/valuation';
import type { FxRateView } from '@/api/v2/types/valuation';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { DateTimeInput } from '@/features/ux-kit/date-inputs';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import { useCalendarPreference } from '@/lib/dates';
import { FinanceField } from '../components/finance-field';
import { FinanceRefusalAlert } from '../components/finance-refusal-alert';
import { serverFieldErrors, type FieldErrors } from '../model/field-errors';
import { emptyFxForm, fxCreateBody, FX_SCALE, validateFxForm, type FxFormValues } from '../model/fx-form';
import { REPORTING_CURRENCIES } from '../model/policy-form';

const CURRENCIES = REPORTING_CURRENCIES.map((code) => ({ value: code, label: code }));

export interface FxRateFormProps {
  timezone: string;
  onSaved: (rate: FxRateView) => void;
  onCancel: () => void;
}

/** A draft exchange rate version; the server validates the shape again and decides overlaps at approval. */
export function FxRateForm({ timezone, onSaved, onCancel }: FxRateFormProps) {
  const calendar = useCalendarPreference().calendar;
  const [values, setValues] = useState<FxFormValues>(emptyFxForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const create = useCreateFxRate();
  const set = <K extends keyof FxFormValues>(key: K, value: FxFormValues[K]) => setValues((prev) => ({ ...prev, [key]: value }));
  const fieldError = (key: string) => errors[key] ?? serverFieldErrors(create.error)[key];
  const save = async () => {
    const found = validateFxForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const saved = await create.submit(fxCreateBody(values)).catch(() => null);
    if (saved) onSaved(saved);
  };
  return (
    <div className="space-y-3" data-testid="fx-form">
      <div className="grid gap-3 sm:grid-cols-3">
        <FinanceField id="fromCurrency" label="From (1 unit of)" error={fieldError('fromCurrency')}>
          <NativeSelect id="fromCurrency" value={values.fromCurrency} options={CURRENCIES} onChange={(v) => set('fromCurrency', v)} />
        </FinanceField>
        <FinanceField id="toCurrency" label="To" error={fieldError('toCurrency')}>
          <NativeSelect id="toCurrency" value={values.toCurrency} options={CURRENCIES} onChange={(v) => set('toCurrency', v)} />
        </FinanceField>
        <FinanceField id="rate" label={`Rate (${values.toCurrency} per 1 ${values.fromCurrency})`} error={fieldError('rate')}>
          <DecimalInput id="rate" value={values.rate} scale={FX_SCALE} onChange={(v) => set('rate', v)} aria-label="Rate" />
        </FinanceField>
      </div>
      <FinanceField id="effectiveFrom" label="Valid from" withLabel={false} error={fieldError('effectiveFrom')}>
        <DateTimeInput label={`Valid from (${timezone})`} value={values.effectiveFrom} timeZone={timezone} calendar={calendar} onChange={(iso) => set('effectiveFrom', iso)} required />
      </FinanceField>
      <FinanceField id="effectiveTo" label="Valid until" withLabel={false} hint="Optional; the rate applies up to, not including, this time." error={fieldError('effectiveTo')}>
        <DateTimeInput label="Valid until (optional)" value={values.effectiveTo} timeZone={timezone} calendar={calendar} onChange={(iso) => set('effectiveTo', iso)} />
      </FinanceField>
      <FinanceField id="fxSource" label="Source (optional)" error={fieldError('source')}>
        <Input id="fxSource" value={values.source} placeholder="e.g. central bank" onChange={(e) => set('source', e.target.value)} />
      </FinanceField>
      <FinanceRefusalAlert error={create.error} />
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={save} disabled={create.isPending} data-testid="fx-save">
          Save draft
        </Button>
      </div>
    </div>
  );
}
