import { useState } from 'react';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  const save = async () => {
    if (await code.submit(reasonCodeId)) onDone();
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="code-dialog">
        <DialogHeader>
          <DialogTitle>Code stop</DialogTitle>
          <DialogDescription>
            {env.unitName(event.unitId)}, since {dateTime(event.startTime)}
          </DialogDescription>
        </DialogHeader>
        <ReasonCodeSelect id="code-reason" value={reasonCodeId} onChange={setReasonCodeId} allowEmpty={false} />
        <CommandError error={code.error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!reasonCodeId || reasonCodeId === event.reasonCodeId || code.pending} onClick={() => void save()}>
            Save reason
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
