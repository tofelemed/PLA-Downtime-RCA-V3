import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateUnitStream } from '@/api/v2/queries/plant-model';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import { useSaveFeedback } from '@/features/ux-kit/save-result';
import { FormField } from '../components/form-field';
import { PlantDateTimeField } from '../components/plant-date-time-field';
import { SaveRefusalAlert } from '../components/save-refusal-alert';
import type { FieldErrors } from '../model/profile-form';
import { refusalOf } from '../model/refusal';
import { emptyStreamForm, streamCreateBody, type StreamFormValues, validateStreamForm } from '../model/stream-form';

export interface UnitStreamFormProps {
  unitId: string;
  timezone: string;
  onDone: () => void;
}

/** A draft stream version: code, name, share of the unit's rate (percent), validity. Toast and close on success; red alert at the top on a refusal. */
export function UnitStreamForm({ unitId, timezone, onDone }: UnitStreamFormProps) {
  const [values, setValues] = useState<StreamFormValues>(() => emptyStreamForm(unitId));
  const [errors, setErrors] = useState<FieldErrors>({});
  const create = useCreateUnitStream();
  const feedback = useSaveFeedback();
  const set = <K extends keyof StreamFormValues>(key: K, value: StreamFormValues[K]) => setValues((prev) => ({ ...prev, [key]: value }));
  const fieldError = (key: string) => errors[key] ?? refusalOf(feedback.failure)?.fieldErrors[key];

  const save = async () => {
    const found = validateStreamForm(values, timezone);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const saved = await feedback.run(() => create.submit(streamCreateBody(values, timezone)), 'Draft stream version added').catch(() => null);
    if (saved) onDone();
  };

  return (
    <div className="space-y-2" data-testid="unit-stream-form">
      <SaveRefusalAlert error={feedback.failure} timezone={timezone} />
      <div className="grid gap-2 sm:grid-cols-3">
        <FormField id="streamCode" label="Code" error={fieldError('code')}>
          <Input id="streamCode" value={values.code} placeholder="T1" onChange={(e) => set('code', e.target.value)} />
        </FormField>
        <FormField id="streamName" label="Name" error={fieldError('name')}>
          <Input id="streamName" value={values.name} placeholder="Train 1" onChange={(e) => set('name', e.target.value)} />
        </FormField>
        <FormField id="streamShare" label="Share of the unit's rate (%)" error={fieldError('capacityShare')}>
          <DecimalInput id="streamShare" value={values.sharePercent} scale={6} onChange={(v) => set('sharePercent', v)} aria-label="Share of the unit's rate in percent" />
        </FormField>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <PlantDateTimeField id="streamFrom" label="Effective from" value={values.effectiveFrom} timezone={timezone} error={fieldError('effectiveFrom')} onChange={(v) => set('effectiveFrom', v)} />
        <PlantDateTimeField id="streamTo" label="Effective to (optional)" value={values.effectiveTo} timezone={timezone} error={fieldError('effectiveTo')} onChange={(v) => set('effectiveTo', v)} />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={create.isPending}>
          Add draft stream
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
