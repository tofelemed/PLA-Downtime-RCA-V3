import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateRate } from '@/api/v2/queries/profile-commands';
import { RATE_KINDS, RATE_TIMEBASES, type RateKind, type RateTimebase } from '@/api/v2/types/profiles';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import { FormField } from '../components/form-field';
import { NativeSelect } from '../components/native-select';
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

const option = (value: string) => ({ value, label: value });

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
      <div className="grid gap-2 sm:grid-cols-5">
        <FormField id="rateKind" label="Kind">
          <NativeSelect id="rateKind" value={values.rateKind} options={RATE_KINDS.map(option)} onChange={(v) => set('rateKind', v as RateKind)} />
        </FormField>
        <FormField id="rate" label={`Rate (${uom ?? 'unit unknown'} per)`} error={fieldError('rate')}>
          <DecimalInput id="rate" value={values.rate} onChange={(v) => set('rate', v)} aria-label="Rate" />
        </FormField>
        <FormField id="timebase" label="Timebase">
          <NativeSelect id="timebase" value={values.timebase} options={RATE_TIMEBASES.map(option)} onChange={(v) => set('timebase', v as RateTimebase)} />
        </FormField>
        <FormField id="rateEffectiveFrom" label={`From (${timezone})`} error={fieldError('effectiveFrom')}>
          <Input id="rateEffectiveFrom" type="datetime-local" value={values.effectiveFrom} onChange={(e) => set('effectiveFrom', e.target.value)} />
        </FormField>
        <FormField id="rateEffectiveTo" label="To (optional)" error={fieldError('effectiveTo')}>
          <Input id="rateEffectiveTo" type="datetime-local" value={values.effectiveTo} onChange={(e) => set('effectiveTo', e.target.value)} />
        </FormField>
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
