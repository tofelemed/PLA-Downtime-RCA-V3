import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCreateValuationRate } from '@/api/v2/queries/profile-commands';
import type { ValuationBasis } from '@/api/v2/types/profiles';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import { VALUATION_BASIS_LABELS } from '@/features/ux-kit/labels';
import { useSaveFeedback } from '@/features/ux-kit/save-result';
import { FormField } from '../components/form-field';
import { NativeSelect } from '../components/native-select';
import { PlantDateTimeField } from '../components/plant-date-time-field';
import { SaveRefusalAlert } from '../components/save-refusal-alert';
import { isRatioBasis, validateValuationForm, valuationCreateBody, type FieldErrors, type ValuationFormValues } from '../model/profile-form';
import { refusalOf } from '../model/refusal';

/**
 * Bases a profile owns (per quantity); cost per hour belongs to impact codes. SME V2: the per-tonne product
 * values of the economic view (scrap cost, salvage, disposal, downgrade price difference, rework cost) and
 * the rework yield — recovered per reworked quantity, a ratio without currency, used where no recovery is
 * recorded.
 */
const PROFILE_BASES: readonly ValuationBasis[] = [
  'contribution_margin',
  'standard_cost',
  'variable_cost',
  'salvage_value',
  'disposal_cost',
  'downgrade_price_difference',
  'rework_cost',
  'rework_yield',
];
const BASES = PROFILE_BASES.map((value) => ({ value, label: VALUATION_BASIS_LABELS[value] }));
/** Rates are entered in IRR or USD (the server refuses other currencies). */
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

/** A new draft valuation rate: toast and close on success (small inline add), red alert at the top on a refusal. */
export function ValuationRateForm({ profileId, uom, timezone, onDone }: ValuationRateFormProps) {
  const [values, setValues] = useState<ValuationFormValues>({ basis: 'contribution_margin', value: null, currency: 'IRR', effectiveFrom: '', effectiveTo: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const create = useCreateValuationRate();
  const feedback = useSaveFeedback();
  const set = <K extends keyof ValuationFormValues>(key: K, value: ValuationFormValues[K]) => setValues((prev) => ({ ...prev, [key]: value }));
  const fieldError = (key: string) => errors[key] ?? refusalOf(feedback.failure)?.fieldErrors[key];
  const ratio = isRatioBasis(values.basis);

  const save = async () => {
    const found = validateValuationForm(values, timezone);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const saved = await feedback.run(() => create.submit(valuationCreateBody(profileId, values, timezone)), 'Draft valuation rate added').catch(() => null);
    if (saved) onDone();
  };

  return (
    <div className="space-y-2" data-testid="valuation-form">
      <SaveRefusalAlert error={feedback.failure} timezone={timezone} />
      <div className="grid gap-2 sm:grid-cols-3">
        <FormField id="basis" label="Basis">
          <NativeSelect id="basis" value={values.basis} options={BASES} onChange={(v) => set('basis', v as ValuationBasis)} />
        </FormField>
        <FormField id="value" label={ratio ? `Recovered ${uom ?? 'unit'} per ${uom ?? 'unit'} reworked (0–1)` : `Value per ${uom ?? 'unit (not set)'}`} error={fieldError('value')}>
          <DecimalInput id="value" value={values.value} onChange={(v) => set('value', v)} aria-label="Value" />
        </FormField>
        {ratio ? (
          <p className="self-end text-xs text-muted-foreground" data-testid="yield-hint">
            A ratio, no currency. Used only where a rework lot has no recorded recovery.
          </p>
        ) : (
          <FormField id="currency" label="Currency" error={fieldError('currency')}>
            <NativeSelect id="currency" value={values.currency} options={CURRENCIES} onChange={(v) => set('currency', v)} />
          </FormField>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <PlantDateTimeField id="valEffectiveFrom" label="Effective from" value={values.effectiveFrom} timezone={timezone} error={fieldError('effectiveFrom')} onChange={(v) => set('effectiveFrom', v)} />
        <PlantDateTimeField id="valEffectiveTo" label="Effective to (optional)" value={values.effectiveTo} timezone={timezone} error={fieldError('effectiveTo')} onChange={(v) => set('effectiveTo', v)} />
      </div>
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
