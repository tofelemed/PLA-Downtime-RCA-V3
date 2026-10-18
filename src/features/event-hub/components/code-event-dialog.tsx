import { useState } from 'react';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useCodeEvent } from '../hooks/use-code-and-close';
import { usePlantFormat } from '../hooks/use-plant-format';
import { useEventHubEnv } from '../use-event-hub-env';
import { CommandError } from './command-error';
import { ReasonCodeSelect } from './reason-code-select';

export interface CodeEventDialogProps {
  event: ProductionEventView;
  onClose: () => void;
  onDone: () => void;
}

/** FE-06 inline "Code": pick a reason and save — the reason code brings its classification defaults. */
export function CodeEventDialog({ event, onClose, onDone }: CodeEventDialogProps) {
  const env = useEventHubEnv();
  const { dateTime } = usePlantFormat();
  const code = useCodeEvent(event);
  const [reasonCodeId, setReasonCodeId] = useState(event.reasonCodeId ?? '');
  const [pending, setPending] = useState(event.investigationPending === true);
  const changes = {
    ...(reasonCodeId && reasonCodeId !== event.reasonCodeId ? { reasonCodeId } : {}),
    ...(pending !== (event.investigationPending === true) ? { investigationPending: pending } : {}),
  };
  const save = async () => {
    if (await code.submit(changes)) onDone();
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="code-dialog">
        <DialogHeader>
          <DialogTitle>{event.classification.physicalType === 'downtime' ? 'Code stop' : 'Code event'}</DialogTitle>
          <DialogDescription>
            {env.unitName(event.unitId)}, since {dateTime(event.startTime)}
          </DialogDescription>
        </DialogHeader>
        <ReasonCodeSelect id="code-reason" value={reasonCodeId} onChange={setReasonCodeId} allowEmpty={false} />
        <div className="flex items-center gap-2">
          <Checkbox id="code-investigation-pending" data-testid="code-investigation-pending" checked={pending} onCheckedChange={(value) => setPending(value === true)} />
          <Label htmlFor="code-investigation-pending" className="font-normal">Investigation pending (no specific reason known yet)</Label>
        </div>
        <CommandError error={code.error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={Object.keys(changes).length === 0 || (!reasonCodeId && !pending) || code.pending} onClick={() => void save()}>
            Save reason
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
