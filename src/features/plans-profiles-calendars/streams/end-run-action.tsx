import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { usePatchStreamRun } from '@/api/v2/queries/plant-model';
import { useSaveFeedback } from '@/features/ux-kit/save-result';
import { plantLocalToUtc } from '@/lib/dates';
import { PlantDateTimeField } from '../components/plant-date-time-field';
import { SaveRefusalAlert } from '../components/save-refusal-alert';

export interface EndRunActionProps {
  runId: string;
  timezone: string;
}

/** Ends a running stream run at a time typed on the plant clock (the server checks it is after the start): toast on success, red alert above the field on a refusal. */
export function EndRunAction({ runId, timezone }: EndRunActionProps) {
  const [open, setOpen] = useState(false);
  const [end, setEnd] = useState('');
  const patch = usePatchStreamRun();
  const feedback = useSaveFeedback();
  const save = async () => {
    const endTime = plantLocalToUtc(end, timezone);
    if (!endTime) return;
    const saved = await feedback.run(() => patch.submit({ id: runId, body: { endTime } }), 'Run ended').catch(() => null);
    if (saved) setOpen(false);
  };
  if (!open)
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        End run
      </Button>
    );
  return (
    <div className="space-y-1">
      <SaveRefusalAlert error={feedback.failure} timezone={timezone} />
      <PlantDateTimeField id={`end-${runId}`} label="End" value={end} timezone={timezone} onChange={setEnd} />
      <div className="flex gap-1">
        <Button size="sm" onClick={save} disabled={patch.isPending || !end}>
          Save end
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
