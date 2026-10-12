import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCreateRate } from '@/api/v2/queries/profile-commands';
import { RATE_KINDS, RATE_TIMEBASES, type RateKind, type RateTimebase } from '@/api/v2/types/profiles';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import { RATE_KIND_LABELS, RATE_TIMEBASE_LABELS } from '@/features/ux-kit/labels';
import { FormField } from '../components/form-field';
import { NativeSelect } from '../components/native-select';
import { PlantDateTimeField } from '../components/plant-date-time-field';
import { RefusalNotice } from '../components/refusal-notice';
import { rateCreateBody, validateRateForm, type FieldErrors, type RateFormValues } from '../model/profile-form';
import { refusalOf } from '../model/refusal';

export interface RateFormProps {
  profileId: string;
  timebase: RateTimebase | null;
  uom: string | null;
  timezone: string;
  onDone: () => void;
}

const KIND_OPTIONS = RATE_KINDS.map((value) => ({ value, label: RATE_KIND_LABELS[value] }));
const TIMEBASE_OPTIONS = RATE_TIMEBASES.map((value) => ({ value, label: RATE_TIMEBASE_LABELS[value] }));

/** A new draft rate version (next version of its kind); the rate is typed as decimal text (8 dp). */
export function RateForm({ profileId, timebase, uom, timezone, onDone }: RateFormProps) {
  const [values, setValues] = useState<RateFormValues>({ rateKind: 'sustained', rate: null, timebase: timebase ?? 'h', effectiveFrom: '', effectiveTo: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const create = useCreateRate();
  const set = <K extends keyof RateFormValues>(key: K, value: RateFormValues[K]) => setValues((prev) => ({ ...prev, [key]: value }));
  const fieldError = (key: string) => errors[key] ?? refusalOf(create.error)?.fieldErrors[key];

  const save = async () => {
    const found = validateRateForm(values, timezone);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const saved = await create.submit({ profileId, body: rateCreateBody(values, timezone) }).catch(() => null);
    if (saved) onDone();
  };

  return (
    <div className="space-y-2 rounded-md border p-3" data-testid="rate-form">
      <div className="grid gap-2 sm:grid-cols-3">
        <FormField id="rateKind" label="Kind">
          <NativeSelect id="rateKind" value={values.rateKind} options={KIND_OPTIONS} onChange={(v) => set('rateKind', v as RateKind)} />
        </FormField>
        <FormField id="rate" label={`Rate (${uom ?? 'unit not set'})`} error={fieldError('rate')}>
          <DecimalInput id="rate" value={values.rate} onChange={(v) => set('rate', v)} aria-label="Rate" />
        </FormField>
        <FormField id="timebase" label="Timebase">
          <NativeSelect id="timebase" value={values.timebase} options={TIMEBASE_OPTIONS} onChange={(v) => set('timebase', v as RateTimebase)} />
        </FormField>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <PlantDateTimeField id="rateEffectiveFrom" label="Effective from" value={values.effectiveFrom} timezone={timezone} error={fieldError('effectiveFrom')} onChange={(v) => set('effectiveFrom', v)} />
        <PlantDateTimeField id="rateEffectiveTo" label="Effective to (optional)" value={values.effectiveTo} timezone={timezone} error={fieldError('effectiveTo')} onChange={(v) => set('effectiveTo', v)} />
      </div>
      <RefusalNotice error={create.error} timezone={timezone} />
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={create.isPending} data-testid="rate-save">
          Add draft rate
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
