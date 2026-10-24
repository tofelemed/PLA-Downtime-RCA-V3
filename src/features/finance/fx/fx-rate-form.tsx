import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useCreateFxRate } from '@/api/v2/queries/valuation';
import type { FxRateType, FxRateView } from '@/api/v2/types/valuation';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { DateTimeInput } from '@/features/ux-kit/date-inputs';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import { FX_RATE_TYPE_LABELS } from '@/features/ux-kit/labels';
import { useSaveFeedback } from '@/features/ux-kit/save-result';
import { useCalendarPreference } from '@/lib/dates';
import { FinanceField } from '../components/finance-field';
import { serverFieldErrors, type FieldErrors } from '../model/field-errors';
import { emptyFxForm, fxCreateBody, FX_SCALE, validateFxForm, type FxFormValues } from '../model/fx-form';
import { REPORTING_CURRENCIES } from '../model/policy-form';

const CURRENCIES = REPORTING_CURRENCIES.map((code) => ({ value: code, label: code }));
const RATE_TYPES = Object.entries(FX_RATE_TYPE_LABELS).map(([value, label]) => ({ value, label }));

export interface FxRateFormProps {
  timezone: string;
  /** the saved draft: the caller closes the dialog and shows the result dialog */
  onSaved: (rate: FxRateView) => void;
  onCancel: () => void;
}

/**
 * A draft exchange rate version; the server validates the shape again and decides overlaps at approval.
 * A refused save is the red alert at the top of the dialog, the refused fields marked and the input kept.
 */
export function FxRateForm({ timezone, onSaved, onCancel }: FxRateFormProps) {
  const calendar = useCalendarPreference().calendar;
  const [values, setValues] = useState<FxFormValues>(emptyFxForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const create = useCreateFxRate();
  const feedback = useSaveFeedback();
  const set = <K extends keyof FxFormValues>(key: K, value: FxFormValues[K]) => setValues((prev) => ({ ...prev, [key]: value }));
  const fieldError = (key: string) => errors[key] ?? serverFieldErrors(create.error)[key];
  const save = async () => {
    const found = validateFxForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const saved = await feedback.run(() => create.submit(fxCreateBody(values)), null).catch(() => null);
    if (saved) onSaved(saved);
  };
  return (
    <div className="space-y-3" data-testid="fx-form">
      {feedback.alert}
      <FinanceField id="rateType" label="Rate table" error={fieldError('rateType')}>
        <NativeSelect id="rateType" value={values.rateType} options={RATE_TYPES} onChange={(v) => set('rateType', v as FxRateType)} />
      </FinanceField>
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
        <DateTimeInput compact label="Valid from" value={values.effectiveFrom} timeZone={timezone} calendar={calendar} onChange={(iso) => set('effectiveFrom', iso)} required />
      </FinanceField>
      <FinanceField id="effectiveTo" label="Valid until" withLabel={false} error={fieldError('effectiveTo')}>
        <DateTimeInput compact label="Valid until (optional)" value={values.effectiveTo} timeZone={timezone} calendar={calendar} onChange={(iso) => set('effectiveTo', iso)} />
      </FinanceField>
      <div className="flex items-center gap-2">
        <Checkbox id="fxProvisional" checked={values.provisional} onCheckedChange={(on) => set('provisional', on === true)} data-testid="fx-provisional" />
        <Label htmlFor="fxProvisional">Provisional rate (only for dates without an approved final rate; needs an end date)</Label>
      </div>
      <FinanceField id="fxSource" label="Source (optional)" error={fieldError('source')}>
        <Input id="fxSource" value={values.source} placeholder="e.g. CBI official fixing, treasury, exchange market" onChange={(e) => set('source', e.target.value)} />
      </FinanceField>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={save} disabled={create.isPending} data-testid="fx-save">
          Save draft
        </Button>
      </div>
    </div>
  );
}
