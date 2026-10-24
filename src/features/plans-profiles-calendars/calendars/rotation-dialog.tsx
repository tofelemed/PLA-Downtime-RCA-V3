import { useState, type FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { useCreateCrewRotation } from '@/api/v2/queries/calendars';
import { DateInput } from '@/features/ux-kit/date-inputs';
import { useSaveFeedback } from '@/features/ux-kit/save-result';
import { FormButtons } from '../components/form-buttons';
import { FormDialog } from '../components/form-dialog';
import { FormField } from '../components/form-field';
import { NativeSelect, type Option } from '../components/native-select';
import { SaveRefusalAlert } from '../components/save-refusal-alert';
import { cycleOf } from '../model/crew-cycle';
import { rotationErrors, type RotationValues } from '../model/rotation-form';

export interface RotationDialogProps {
  crewOptions: Option[];
  /** the crew chosen on the page ('' = none) */
  crewId: string;
  timezone: string;
  /** closed; `crewId` = the crew a rotation was just added to */
  onClose: (crewId?: string) => void;
}

const INFO = 'A cycle of shift names from day 1 (“-” = a day off); the server re-assigns the crew’s future shift instances.';
const PICKER = {};

/**
 * "Add rotation" dialog: missing fields are said under each field on Add; a toast and the dialog closes on
 * success; a refusal is the red alert at the top, the input kept. Dates are typed in the plant format or
 * picked in the plant calendar.
 */
export function RotationDialog({ crewOptions, crewId: chosen, timezone, onClose }: RotationDialogProps) {
  const [values, setValues] = useState<RotationValues>({ crewId: chosen, cycle: '', anchorDate: '', effectiveFrom: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof RotationValues, string>>>({});
  const createRotation = useCreateCrewRotation();
  const feedback = useSaveFeedback();
  const busy = createRotation.isPending;
  const set = (patch: Partial<RotationValues>) => setValues((prev) => ({ ...prev, ...patch }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = rotationErrors(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const body = { crewId: values.crewId, effectiveFrom: values.effectiveFrom, pattern: { anchorDate: values.anchorDate, cycle: cycleOf(values.cycle) } };
    const saved = await feedback.run(() => createRotation.submit(body), 'Rotation added').catch(() => null);
    if (saved) onClose(values.crewId);
  };
  return (
    <FormDialog open onOpenChange={(open) => !open && !busy && onClose()} title="Add rotation" info={INFO} testId="rotation-dialog">
      <form noValidate className="space-y-3" data-testid="rotation-form" onSubmit={(e) => void submit(e)}>
        <SaveRefusalAlert error={feedback.failure} timezone={timezone} />
        <FormField id="rotationCrew" label="Crew" required error={errors.crewId}>
          <NativeSelect id="rotationCrew" value={values.crewId} options={crewOptions} placeholder="Choose a crew" onChange={(crewId) => set({ crewId })} />
        </FormField>
        <FormField id="rotationCycle" label="Cycle (shift names, “-” = off)" required error={errors.cycle}>
          <Input id="rotationCycle" className="h-9" value={values.cycle} placeholder="A,A,B,B,C,C,-,-" onChange={(e) => set({ cycle: e.target.value })} />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <DateInput id="rotationAnchor" label="Cycle day 1" required compact textEntry calendarPicker={PICKER} value={values.anchorDate} error={errors.anchorDate} onChange={(anchorDate) => set({ anchorDate })} />
          <DateInput id="rotationFrom" label="Effective from" required compact textEntry calendarPicker={PICKER} value={values.effectiveFrom} error={errors.effectiveFrom} onChange={(effectiveFrom) => set({ effectiveFrom })} />
        </div>
        <FormButtons label="Add rotation" busy={busy} onCancel={() => onClose()} />
      </form>
    </FormDialog>
  );
}
