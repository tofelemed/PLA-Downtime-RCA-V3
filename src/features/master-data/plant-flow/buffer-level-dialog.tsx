import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { Input } from '@/components/ui/input';
import { useRecordBufferLevel } from '@/api/v2/queries/plant-model';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import { useSaveFeedback } from '@/features/ux-kit/save-result';
import { focusFirstField } from './focus-first-field';
import { FormField } from '@/features/plans-profiles-calendars/components/form-field';
import { NativeSelect, type Option } from '@/features/plans-profiles-calendars/components/native-select';
import type { FieldErrors } from '@/features/plans-profiles-calendars/model/profile-form';
import { refusalOf } from '@/features/plans-profiles-calendars/model/refusal';
import { FlowDateTimeField } from './flow-date-time-field';
import { PlantFlowSaveAlert } from './plant-flow-save-alert';
import { bufferLevelCreateBody, type BufferLevelFormValues, emptyBufferLevelForm, validateBufferLevelForm } from './plant-flow-form-model';

export interface BufferLevelDialogProps {
  bufferOptions: Option[];
  timezone: string;
  onClose: () => void;
}

function useBufferLevelSave(timezone: string, onClose: () => void) {
  const [values, setValues] = useState<BufferLevelFormValues>(emptyBufferLevelForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const record = useRecordBufferLevel();
  const feedback = useSaveFeedback();
  const set = <K extends keyof BufferLevelFormValues>(key: K, value: BufferLevelFormValues[K]) => setValues((prev) => ({ ...prev, [key]: value }));
  const fieldError = (key: string) => errors[key] ?? refusalOf(feedback.failure)?.fieldErrors[key];
  const save = async () => {
    const found = validateBufferLevelForm(values, timezone);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const saved = await feedback.run(() => record.submit(bufferLevelCreateBody(values, timezone)), 'Buffer level recorded').catch(() => null);
    if (saved) onClose();
  };
  return { values, set, fieldError, save, failure: feedback.failure, busy: record.isPending };
}

/**
 * "Record buffer level" dialog: a level read at an instant (used as cover by stops starting within 24 h of it).
 * A recorded level ends in a toast and the dialog closes; a refusal is the red alert at the top, the input kept.
 */
export function BufferLevelDialog({ bufferOptions, timezone, onClose }: BufferLevelDialogProps) {
  const { values, set, fieldError, save, failure, busy } = useBufferLevelSave(timezone, onClose);
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-[560px]" aria-describedby={undefined} onOpenAutoFocus={focusFirstField('levelRoute')}>
        <DialogHeader>
          <div className="flex items-center gap-1.5">
            <DialogTitle>Record buffer level</DialogTitle>
            <KpiInfo label="Record buffer level" text="A level read within 24 h before an upstream stop replaces the configured usable inventory." />
          </div>
        </DialogHeader>
        <form noValidate className="space-y-3 [&_input]:h-9" data-testid="buffer-level-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <PlantFlowSaveAlert error={failure} timezone={timezone} />
          <FormField id="levelRoute" label="Buffer" error={fieldError('fromUnitId')}>
            <NativeSelect id="levelRoute" value={values.routeKey} options={bufferOptions} placeholder="Choose…" onChange={(v) => set('routeKey', v)} />
          </FormField>
          <FlowDateTimeField id="levelAt" label="Read at" value={values.observedAt} timezone={timezone} error={fieldError('observedAt')} onChange={(v) => set('observedAt', v)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="levelValue" label="Level" error={fieldError('level')}>
              <DecimalInput id="levelValue" value={values.level} onChange={(v) => set('level', v)} aria-label="Buffer level" />
            </FormField>
            <FormField id="levelUom" label="Unit" error={fieldError('uom')}>
              <Input id="levelUom" value={values.uom} onChange={(e) => set('uom', e.target.value)} />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-9" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" className="h-9" disabled={busy}>Record level</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
