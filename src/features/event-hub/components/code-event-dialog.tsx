import { useState } from 'react';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCodeEvent, type CodeChanges } from '../hooks/use-code-and-close';
import { usePlantFormat } from '../hooks/use-plant-format';
import { useSavedReasonToast } from '../hooks/use-saved-reason-toast';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useReasonSplit, type ReasonSplitState } from '../hooks/use-reason-split';
import { isProductionLoss, shortfallOf } from '../model/production-loss';
import { useEventHubEnv } from '../use-event-hub-env';
import { SPLIT_LOCKED_ID, splitLocked } from '../model/split-lock';
import { CommandError } from './command-error';
import { ReasonChoice } from './reason-choice';

export interface CodeEventDialogProps {
  event: ProductionEventView;
  onClose: () => void;
  onDone: () => void;
}

interface Picked {
  reasonCodeId: string;
  pending: boolean;
  /** the note as typed; empty = none */
  note: string;
}

/** The note the PATCH carries: the trimmed text when it changed, null when a stored note was emptied, else nothing. */
function noteChange(event: ProductionEventView, note: string): Pick<CodeChanges, 'codingNote'> {
  const text = note.trim();
  const stored = event.codingNote ?? '';
  if (text === stored) return {};
  return { codingNote: text === '' ? null : text };
}

/**
 * The PATCH of the dialog: a new reason (no split), a changed "investigation pending", the note and the split's
 * change. `locked` (a split the user may not change): the note and the investigation flag only.
 */
function changesOf(event: ProductionEventView, picked: Picked, split: ReasonSplitState, locked: boolean): CodeChanges {
  const recoded = !locked && !split.enabled && picked.reasonCodeId !== '' && picked.reasonCodeId !== event.reasonCodeId;
  const pendingChanged = picked.pending !== (event.investigationPending === true);
  return {
    ...(recoded ? { reasonCodeId: picked.reasonCodeId } : {}),
    ...(pendingChanged ? { investigationPending: picked.pending } : {}),
    ...noteChange(event, picked.note),
    ...(locked ? {} : split.change()),
  };
}

const NOTE_MAX = 1000;

/** Why Save is off: nothing changed, no reason or flag given, an incomplete split, or a request in flight. */
function saveBlocked(args: { changes: CodeChanges; reasonGiven: boolean; pending: boolean; locked: boolean; split: ReasonSplitState; busy: boolean }): boolean {
  const { changes, reasonGiven, pending, locked, split, busy } = args;
  return Object.keys(changes).length === 0 || (!reasonGiven && !pending) || (!locked && !split.complete) || busy;
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
  const [note, setNote] = useState(event.codingNote ?? '');
  const split = useReasonSplit(event, shortfallOf(event));
  const { canSplitReasons } = useCapabilities();
  const locked = splitLocked(event, canSplitReasons);
  const changes = changesOf(event, { reasonCodeId, pending, note }, split, locked);
  const reasonGiven = locked || (split.enabled ? split.complete : Boolean(reasonCodeId));
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
        <ReasonChoice event={event} split={split} reasonCodeId={reasonCodeId} onReason={setReasonCodeId} />
        <div className="space-y-1">
          <Label htmlFor="code-note">Note (optional, in your own words)</Label>
          <Textarea id="code-note" data-testid="code-note" value={note} maxLength={NOTE_MAX} rows={2} placeholder="What happened, for the reader and the investigation; the reason code stays the attribution" onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="code-investigation-pending" data-testid="code-investigation-pending" checked={pending} onCheckedChange={(value) => setPending(value === true)} />
          <Label htmlFor="code-investigation-pending" className="font-normal">Investigation pending (no specific reason known yet)</Label>
        </div>
        <CommandError error={code.error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={saveBlocked({ changes, reasonGiven, pending, locked, split, busy: code.pending })}
            aria-describedby={locked ? SPLIT_LOCKED_ID : undefined}
            onClick={() => void save()}
          >
            Save reason
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
