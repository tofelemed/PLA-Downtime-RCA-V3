import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRecordBufferLevel } from '@/api/v2/queries/plant-model';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import { FormField } from '@/features/plans-profiles-calendars/components/form-field';
import { NativeSelect, type Option } from '@/features/plans-profiles-calendars/components/native-select';
import { PlantDateTimeField } from '@/features/plans-profiles-calendars/components/plant-date-time-field';
import { RefusalNotice } from '@/features/plans-profiles-calendars/components/refusal-notice';
import type { FieldErrors } from '@/features/plans-profiles-calendars/model/profile-form';
import { refusalOf } from '@/features/plans-profiles-calendars/model/refusal';
import { bufferLevelCreateBody, type BufferLevelFormValues, emptyBufferLevelForm, validateBufferLevelForm } from './plant-flow-form-model';

export interface BufferLevelFormProps {
  bufferOptions: Option[];
  timezone: string;
}

/** Records a buffer level read at an instant (used as cover by stops starting within 24 h of it). */
export function BufferLevelForm({ bufferOptions, timezone }: BufferLevelFormProps) {
  const [values, setValues] = useState<BufferLevelFormValues>(emptyBufferLevelForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const record = useRecordBufferLevel();
  const set = <K extends keyof BufferLevelFormValues>(key: K, value: BufferLevelFormValues[K]) => setValues((prev) => ({ ...prev, [key]: value }));
  const fieldError = (key: string) => errors[key] ?? refusalOf(record.error)?.fieldErrors[key];

  const save = async () => {
    const found = validateBufferLevelForm(values, timezone);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const saved = await record.submit(bufferLevelCreateBody(values, timezone)).catch(() => null);
    if (saved) setValues(emptyBufferLevelForm());
  };

  return (
    <div className="space-y-2 rounded-md border p-3" data-testid="buffer-level-form">
      <div className="grid gap-2 sm:grid-cols-4">
        <FormField id="levelRoute" label="Buffer" error={fieldError('fromUnitId')}>
          <NativeSelect id="levelRoute" value={values.routeKey} options={bufferOptions} placeholder="Choose…" onChange={(v) => set('routeKey', v)} />
        </FormField>
        <PlantDateTimeField id="levelAt" label="Read at" value={values.observedAt} timezone={timezone} error={fieldError('observedAt')} onChange={(v) => set('observedAt', v)} />
        <FormField id="levelValue" label="Level" error={fieldError('level')}>
          <DecimalInput id="levelValue" value={values.level} onChange={(v) => set('level', v)} aria-label="Buffer level" />
        </FormField>
        <FormField id="levelUom" label="Unit" error={fieldError('uom')}>
          <Input id="levelUom" value={values.uom} onChange={(e) => set('uom', e.target.value)} />
        </FormField>
      </div>
      <RefusalNotice error={record.error} timezone={timezone} />
      <Button size="sm" onClick={save} disabled={record.isPending}>
        Record level
      </Button>
    </div>
  );
}
