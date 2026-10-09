import { useState } from 'react';
import { useCloseEvent } from '@/api/v2/queries/event-commands';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { plantLocalToUtc, utcToPlantLocal } from '../model/plant-local-time';
import { useEventHubEnv } from '../use-event-hub-env';
import { CommandError } from './command-error';

export interface CloseStopDialogProps {
  event: ProductionEventView;
  onClose: () => void;
  onDone: () => void;
}

/** DT10 close of a running stop; the server refuses an end before the start or in the future (422). */
export function CloseStopDialog({ event, onClose, onDone }: CloseStopDialogProps) {
  const env = useEventHubEnv();
  const close = useCloseEvent();
  const [endLocal, setEndLocal] = useState(() => utcToPlantLocal(event.asOf, env.timezone));
  const [reason, setReason] = useState('');
  const endTime = plantLocalToUtc(endLocal, env.timezone);
  const submit = async () => {
    if (!endTime) return;
    const result = await close.submit({ event, body: { endTime, reason: reason.trim() } }).catch(() => null);
    if (result) onDone();
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="close-dialog">
        <DialogHeader>
          <DialogTitle>Close stop</DialogTitle>
          <DialogDescription>
            Running since <PlantTime iso={event.startTime} tz={env.timezone} withDate />. Closing is not approving.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="close-end">End (plant time, {env.timezone})</Label>
            <Input id="close-end" type="datetime-local" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="close-reason">Why (kept in the history)</Label>
            <Textarea id="close-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
          </div>
        </div>
        <CommandError error={close.error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!endTime || reason.trim() === '' || close.isPending} onClick={() => void submit()}>Close stop</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
