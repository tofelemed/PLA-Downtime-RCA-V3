import { useState } from 'react';
import { useSplitEvent } from '@/api/v2/queries/event-commands';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { useEventHubEnv } from '../use-event-hub-env';
import { CommandError } from './command-error';

export interface SplitDialogProps {
  event: ProductionEventView;
  onClose: () => void;
  onDone: (createdIds: string[]) => void;
}

const MINUTE_MS = 60_000;

/** Whole minutes strictly inside the event (an open event ends at the server's as-of instant). */
function splitRange(event: ProductionEventView) {
  const start = Date.parse(event.startTime);
  const end = Date.parse(event.endTime ?? event.asOf);
  const steps = Math.max(0, Math.floor((end - start) / MINUTE_MS) - 1);
  return { start, steps };
}

/** DT09 split at an instant chosen on a slider; the preview names the two resulting intervals. */
export function SplitDialog({ event, onClose, onDone }: SplitDialogProps) {
  const env = useEventHubEnv();
  const split = useSplitEvent();
  const { start, steps } = splitRange(event);
  const [offset, setOffset] = useState(Math.max(1, Math.round(steps / 2)));
  const [reason, setReason] = useState('');
  const splitAt = new Date(start + offset * MINUTE_MS).toISOString();
  const submit = async () => {
    const result = await split.submit({ event, body: { splitAt, reason: reason.trim() } }).catch(() => null);
    if (result) onDone(result.createdEventIds);
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="split-dialog">
        <DialogHeader>
          <DialogTitle>Split event</DialogTitle>
          <DialogDescription>Both parts keep the coding and the stop occurrence; the original becomes superseded.</DialogDescription>
        </DialogHeader>
        {steps < 1 ? (
          <p className="text-sm">The event is too short to split at a whole minute.</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="split-at">Split at <PlantTime iso={splitAt} tz={env.timezone} withDate /></Label>
              <Slider id="split-at" min={1} max={steps} step={1} value={[offset]} onValueChange={([value]) => setOffset(value)} aria-label="Split instant" />
            </div>
            <ul className="text-sm" data-testid="split-preview" aria-label="Resulting events">
              <li>Part 1: <PlantTime iso={event.startTime} tz={env.timezone} /> – <PlantTime iso={splitAt} tz={env.timezone} /></li>
              <li>Part 2: <PlantTime iso={splitAt} tz={env.timezone} /> – {event.endTime ? <PlantTime iso={event.endTime} tz={env.timezone} /> : 'running'}</li>
            </ul>
            <div className="space-y-1">
              <Label htmlFor="split-reason">Why (kept in the history)</Label>
              <Textarea id="split-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
            </div>
          </div>
        )}
        <CommandError error={split.error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={steps < 1 || reason.trim() === '' || split.isPending} onClick={() => void submit()}>Split</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
