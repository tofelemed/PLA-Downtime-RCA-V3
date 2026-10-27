import { useState } from 'react';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useCodeEvent, type CodeChanges } from '../hooks/use-code-and-close';
import { usePlantFormat } from '../hooks/use-plant-format';
import { useSavedReasonToast } from '../hooks/use-saved-reason-toast';
import { useReasonSplit, type ReasonSplitState } from '../hooks/use-reason-split';
import { isProductionLoss, shortfallOf } from '../model/production-loss';
import { useEventHubEnv } from '../use-event-hub-env';
import { CommandError } from './command-error';
import { ReasonCodeSelect } from './reason-code-select';
import { ReasonSplitSection } from './reason-split-section';

export interface CodeEventDialogProps {
  event: ProductionEventView;
  onClose: () => void;
  onDone: () => void;
}

/** The PATCH of the dialog: a new reason (no split), a changed "investigation pending", and the split's change. */
function changesOf(event: ProductionEventView, picked: { reasonCodeId: string; pending: boolean }, split: ReasonSplitState): CodeChanges {
  const recoded = !split.enabled && picked.reasonCodeId !== '' && picked.reasonCodeId !== event.reasonCodeId;
  const pendingChanged = picked.pending !== (event.investigationPending === true);
  return {
    ...(recoded ? { reasonCodeId: picked.reasonCodeId } : {}),
    ...(pendingChanged ? { investigationPending: picked.pending } : {}),
    ...split.change(),
  };
}

function titleOf(event: ProductionEventView): string {
  if (isProductionLoss(event)) return 'Code production loss';
  return event.classification.physicalType === 'downtime' ? 'Code stop' : 'Code event';
}

/**
 * FE-06 inline "Code": pick a reason and save — the reason code brings its classification defaults. A stop can
 * instead be split across several reasons (D-T5); the server normalises the split and answers with its reason
 * when it does not add up.
 */
export function CodeEventDialog({ event, onClose, onDone }: CodeEventDialogProps) {
  const env = useEventHubEnv();
  const { dateTime } = usePlantFormat();
  const code = useCodeEvent(event);
  const savedToast = useSavedReasonToast(event);
  const [reasonCodeId, setReasonCodeId] = useState(event.reasonCodeId ?? '');
  const [pending, setPending] = useState(event.investigationPending === true);
  const split = useReasonSplit(event, shortfallOf(event));
  const changes = changesOf(event, { reasonCodeId, pending }, split);
  const reasonGiven = split.enabled ? split.complete : Boolean(reasonCodeId);
  const save = async () => {
    if (!(await code.submit(changes))) return;
    savedToast();
    onDone();
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="code-dialog">
        <DialogHeader>
          <DialogTitle>{titleOf(event)}</DialogTitle>
          <DialogDescription>
            {env.unitName(event.unitId)}, {event.endTime ? `${dateTime(event.startTime)} – ${dateTime(event.endTime)}` : `since ${dateTime(event.startTime)}`}
          </DialogDescription>
        </DialogHeader>
        {!split.enabled && <ReasonCodeSelect id="code-reason" value={reasonCodeId} onChange={setReasonCodeId} allowEmpty={false} />}
        <ReasonSplitSection split={split} />
        <div className="flex items-center gap-2">
          <Checkbox id="code-investigation-pending" data-testid="code-investigation-pending" checked={pending} onCheckedChange={(value) => setPending(value === true)} />
          <Label htmlFor="code-investigation-pending" className="font-normal">Investigation pending (no specific reason known yet)</Label>
        </div>
        <CommandError error={code.error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={Object.keys(changes).length === 0 || (!reasonGiven && !pending) || !split.complete || code.pending} onClick={() => void save()}>
            Save reason
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
