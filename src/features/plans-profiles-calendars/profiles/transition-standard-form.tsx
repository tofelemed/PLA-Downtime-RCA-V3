import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCreateTransitionStandard } from '@/api/v2/queries/profile-commands';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import { useSaveFeedback } from '@/features/ux-kit/save-result';
import { FormButtons } from '../components/form-buttons';
import { FormField } from '../components/form-field';
import { NativeSelect, type Option } from '../components/native-select';
import { PlantDateTimeField } from '../components/plant-date-time-field';
import { SaveRefusalAlert } from '../components/save-refusal-alert';
import type { FieldErrors } from '../model/profile-form';
import { refusalOf } from '../model/refusal';
import {
  emptyTransitionStandardForm,
  transitionStandardCreateBody,
  type TransitionStandardFormValues,
  validateTransitionStandardForm,
} from '../model/transition-standard-form';

export interface TransitionStandardFormProps {
  unitId: string;
  productOptions: Option[];
  timezone: string;
  onDone: () => void;
}

/** A draft matrix entry: directional product change with optional catalyst family / operating mode (SME E1), reference hours, optional reference off-grade, evidence. Shown in the tab's "Add transition standard" dialog: toast and close on success; red alert at the top on a refusal, input kept. */
export function TransitionStandardForm({ unitId, productOptions, timezone, onDone }: TransitionStandardFormProps) {
  const [values, setValues] = useState<TransitionStandardFormValues>(() => emptyTransitionStandardForm(unitId));
  const [errors, setErrors] = useState<FieldErrors>({});
  const create = useCreateTransitionStandard();
  const feedback = useSaveFeedback();
  const set = <K extends keyof TransitionStandardFormValues>(key: K, value: TransitionStandardFormValues[K]) => setValues((prev) => ({ ...prev, [key]: value }));
  const fieldError = (key: string) => errors[key] ?? refusalOf(feedback.failure)?.fieldErrors[key];

  const save = async () => {
    const found = validateTransitionStandardForm(values, timezone);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const saved = await feedback.run(() => create.submit(transitionStandardCreateBody(values, timezone)), 'Draft transition standard added').catch(() => null);
    if (saved) onDone();
  };

  return (
    <div className="space-y-2" data-testid="transition-standard-form">
      <SaveRefusalAlert error={feedback.failure} timezone={timezone} />
      <div className="grid gap-2 sm:grid-cols-2">
        <FormField id="tsFrom" label="From product" error={fieldError('fromProductId')}>
          <NativeSelect id="tsFrom" value={values.fromProductId} options={productOptions} placeholder="Choose…" onChange={(v) => set('fromProductId', v)} />
        </FormField>
        <FormField id="tsTo" label="To product" error={fieldError('toProductId')}>
          <NativeSelect id="tsTo" value={values.toProductId} options={productOptions} placeholder="Choose…" onChange={(v) => set('toProductId', v)} />
        </FormField>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <FormField id="tsCatalyst" label="Catalyst family (blank = any)" error={fieldError('catalystFamily')}>
          <Input id="tsCatalyst" value={values.catalystFamily} placeholder="any" onChange={(e) => set('catalystFamily', e.target.value)} />
        </FormField>
        <FormField id="tsMode" label="Operating mode (blank = any)" error={fieldError('operatingMode')}>
          <Input id="tsMode" value={values.operatingMode} placeholder="any" onChange={(e) => set('operatingMode', e.target.value)} />
        </FormField>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <FormField id="tsHours" label="Reference duration (h)" error={fieldError('referenceSeconds')}>
          <DecimalInput id="tsHours" value={values.referenceHours} scale={3} onChange={(v) => set('referenceHours', v)} aria-label="Reference duration in hours" />
        </FormField>
        <FormField id="tsOffgrade" label="Reference off-grade (optional)" error={fieldError('referenceOffgradeQty')}>
          <DecimalInput id="tsOffgrade" value={values.referenceOffgradeQty} onChange={(v) => set('referenceOffgradeQty', v)} aria-label="Reference off-grade quantity" />
        </FormField>
        <FormField id="tsUom" label="Off-grade unit" error={fieldError('offgradeUom')}>
          <Input id="tsUom" value={values.offgradeUom} onChange={(e) => set('offgradeUom', e.target.value)} />
        </FormField>
        <FormField id="tsSamples" label="Transitions observed" error={fieldError('sampleCount')}>
          <Input id="tsSamples" inputMode="numeric" value={values.sampleCount} onChange={(e) => set('sampleCount', e.target.value)} />
        </FormField>
      </div>
      <FormField id="tsEvidence" label="Evidence (how the reference was derived)" error={fieldError('evidence')}>
        <Textarea id="tsEvidence" value={values.evidence} onChange={(e) => set('evidence', e.target.value)} rows={2} />
      </FormField>
      <div className="grid gap-2 sm:grid-cols-2">
        <PlantDateTimeField compact id="tsEffectiveFrom" label="Effective from" value={values.effectiveFrom} timezone={timezone} error={fieldError('effectiveFrom')} onChange={(v) => set('effectiveFrom', v)} />
        <PlantDateTimeField compact id="tsEffectiveTo" label="Effective to (optional)" value={values.effectiveTo} timezone={timezone} error={fieldError('effectiveTo')} onChange={(v) => set('effectiveTo', v)} />
      </div>
      <FormButtons label="Add draft standard" busy={create.isPending} onSave={() => void save()} onCancel={onDone} testId="transition-standard-save" />
    </div>
  );
}
