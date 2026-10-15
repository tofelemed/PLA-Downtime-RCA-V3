import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateStreamRun } from '@/api/v2/queries/plant-model';
import { FormField } from '../components/form-field';
import { NativeSelect, type Option } from '../components/native-select';
import { PlantDateTimeField } from '../components/plant-date-time-field';
import { RefusalNotice } from '../components/refusal-notice';
import type { FieldErrors } from '../model/profile-form';
import { refusalOf } from '../model/refusal';
import { emptyStreamRunForm, streamRunCreateBody, type StreamRunFormValues, validateStreamRunForm } from '../model/stream-form';

export interface StreamRunFormProps {
  unitId: string;
  streamOptions: Option[];
  productOptions: Option[];
  timezone: string;
  onDone: () => void;
}

/** Records which product a stream runs from a start (open-ended until ended) and the lot it makes. */
export function StreamRunForm({ unitId, streamOptions, productOptions, timezone, onDone }: StreamRunFormProps) {
  const [values, setValues] = useState<StreamRunFormValues>(() => emptyStreamRunForm(unitId));
  const [errors, setErrors] = useState<FieldErrors>({});
  const create = useCreateStreamRun();
  const set = <K extends keyof StreamRunFormValues>(key: K, value: StreamRunFormValues[K]) => setValues((prev) => ({ ...prev, [key]: value }));
  const fieldError = (key: string) => errors[key] ?? refusalOf(create.error)?.fieldErrors[key];

  const save = async () => {
    const found = validateStreamRunForm(values, timezone);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const saved = await create.submit(streamRunCreateBody(values, timezone)).catch(() => null);
    if (saved) onDone();
  };

  return (
    <div className="space-y-2 rounded-md border p-3" data-testid="stream-run-form">
      <div className="grid gap-2 sm:grid-cols-3">
        <FormField id="runStream" label="Stream" error={fieldError('streamCode')}>
          <NativeSelect id="runStream" value={values.streamCode} options={streamOptions} placeholder="Choose…" onChange={(v) => set('streamCode', v)} />
        </FormField>
        <FormField id="runProduct" label="Product" error={fieldError('productId')}>
          <NativeSelect id="runProduct" value={values.productId} options={productOptions} placeholder="Choose…" onChange={(v) => set('productId', v)} />
        </FormField>
        <FormField id="runLot" label="Lot code (optional)" error={fieldError('lotCode')}>
          <Input id="runLot" value={values.lotCode} onChange={(e) => set('lotCode', e.target.value)} />
        </FormField>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <PlantDateTimeField id="runStart" label="Start" value={values.startTime} timezone={timezone} error={fieldError('startTime')} onChange={(v) => set('startTime', v)} />
        <PlantDateTimeField id="runEnd" label="End (optional, blank = still running)" value={values.endTime} timezone={timezone} error={fieldError('endTime')} onChange={(v) => set('endTime', v)} />
      </div>
      <RefusalNotice error={create.error} timezone={timezone} />
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={create.isPending}>
          Record run
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
