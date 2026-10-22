import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useCreateCrew } from '@/api/v2/queries/calendars';
import { useSaveFeedback } from '@/features/ux-kit/save-result';
import { FormField } from '../components/form-field';
import { SaveRefusalAlert } from '../components/save-refusal-alert';

export interface CrewDialogProps {
  siteId: string | undefined;
  timezone: string;
  /** closed; `crewId` = the crew just added */
  onClose: (crewId?: string) => void;
}

/** "Add crew" dialog: a toast and the dialog closes on success (the new crew is chosen); a refusal is the red alert at the top, the name kept. */
export function CrewDialog({ siteId, timezone, onClose }: CrewDialogProps) {
  const [name, setName] = useState('');
  const createCrew = useCreateCrew();
  const feedback = useSaveFeedback();
  const busy = createCrew.isPending;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    const crew = await feedback.run(() => createCrew.submit({ name, ...(siteId ? { siteId } : {}) }), 'Crew added').catch(() => null);
    if (crew) onClose(crew.id);
  };
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add crew</DialogTitle>
          <DialogDescription>Crews only label shift instances; they never change shift bounds or scheduled time.</DialogDescription>
        </DialogHeader>
        <form noValidate className="space-y-3" data-testid="crew-form" onSubmit={(e) => void submit(e)}>
          <SaveRefusalAlert error={feedback.failure} timezone={timezone} />
          <FormField id="crewName" label="Crew name">
            <Input id="crewName" value={name} onChange={(e) => setName(e.target.value)} maxLength={255} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onClose()} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || busy}>Add crew</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
