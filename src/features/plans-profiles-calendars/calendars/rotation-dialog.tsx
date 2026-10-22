import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useCreateCrewRotation } from '@/api/v2/queries/calendars';
import { DateInput } from '@/features/ux-kit/date-inputs';
import { useSaveFeedback } from '@/features/ux-kit/save-result';
import { FormField } from '../components/form-field';
import { NativeSelect, type Option } from '../components/native-select';
import { SaveRefusalAlert } from '../components/save-refusal-alert';
import { cycleOf } from '../model/crew-cycle';

export interface RotationDialogProps {
  crewOptions: Option[];
  /** the crew chosen on the page ('' = none) */
  crewId: string;
  timezone: string;
  /** closed; `crewId` = the crew a rotation was just added to */
  onClose: (crewId?: string) => void;
}

/** "Add rotation" dialog: a toast and the dialog closes on success; a refusal is the red alert at the top, the input kept. */
export function RotationDialog({ crewOptions, crewId: chosen, timezone, onClose }: RotationDialogProps) {
  const [crewId, setCrewId] = useState(chosen);
  const [cycle, setCycle] = useState('');
  const [anchorDate, setAnchorDate] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const createRotation = useCreateCrewRotation();
  const feedback = useSaveFeedback();
  const busy = createRotation.isPending;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const body = { crewId, effectiveFrom, pattern: { anchorDate, cycle: cycleOf(cycle) } };
    const saved = await feedback.run(() => createRotation.submit(body), 'Rotation added').catch(() => null);
    if (saved) onClose(crewId);
  };
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add rotation</DialogTitle>
          <DialogDescription>A cycle of shift names from day 1; the server re-assigns the crew’s future shift instances.</DialogDescription>
        </DialogHeader>
        <form noValidate className="space-y-3" data-testid="rotation-form" onSubmit={(e) => void submit(e)}>
          <SaveRefusalAlert error={feedback.failure} timezone={timezone} />
          <FormField id="rotationCrew" label="Crew">
            <NativeSelect id="rotationCrew" value={crewId} options={crewOptions} placeholder="Choose a crew" onChange={setCrewId} />
          </FormField>
          <FormField id="rotationCycle" label="Cycle (shift names, “-” = off)" hint="e.g. A,A,B,B,C,C,-,-">
            <Input id="rotationCycle" value={cycle} onChange={(e) => setCycle(e.target.value)} />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <DateInput id="rotationAnchor" label="Cycle day 1" value={anchorDate} onChange={setAnchorDate} />
            <DateInput id="rotationFrom" label="Effective from" value={effectiveFrom} onChange={setEffectiveFrom} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onClose()} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={!crewId || !cycle || !anchorDate || !effectiveFrom || busy}>Add rotation</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
