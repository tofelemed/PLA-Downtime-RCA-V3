import { useState, type FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { useCreateCrew } from '@/api/v2/queries/calendars';
import { useSaveFeedback } from '@/features/ux-kit/save-result';
import { FormButtons } from '../components/form-buttons';
import { FormDialog } from '../components/form-dialog';
import { FormField } from '../components/form-field';
import { SaveRefusalAlert } from '../components/save-refusal-alert';

export interface CrewDialogProps {
  siteId: string | undefined;
  timezone: string;
  /** closed; `crewId` = the crew just added */
  onClose: (crewId?: string) => void;
}

const INFO = 'Crews only label shift instances; they never change shift bounds or scheduled time.';

/**
 * "Add crew" dialog: a missing name is said under the field; a toast and the dialog closes on success (the new
 * crew is chosen); a refusal is the red alert at the top, the name kept.
 */
export function CrewDialog({ siteId, timezone, onClose }: CrewDialogProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const createCrew = useCreateCrew();
  const feedback = useSaveFeedback();
  const busy = createCrew.isPending;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return setError('Enter the crew name.');
    setError(null);
    const crew = await feedback.run(() => createCrew.submit({ name, ...(siteId ? { siteId } : {}) }), 'Crew added').catch(() => null);
    if (crew) onClose(crew.id);
  };
  return (
    <FormDialog open onOpenChange={(open) => !open && !busy && onClose()} title="Add crew" info={INFO} testId="crew-dialog">
      <form noValidate className="space-y-3" data-testid="crew-form" onSubmit={(e) => void submit(e)}>
        <SaveRefusalAlert error={feedback.failure} timezone={timezone} />
        <FormField id="crewName" label="Crew name" required error={error}>
          <Input id="crewName" className="h-9" value={name} onChange={(e) => setName(e.target.value)} maxLength={255} />
        </FormField>
        <FormButtons label="Add crew" busy={busy} onCancel={() => onClose()} />
      </form>
    </FormDialog>
  );
}
