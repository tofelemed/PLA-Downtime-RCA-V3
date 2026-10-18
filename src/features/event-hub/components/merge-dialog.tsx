import { useState } from 'react';
import { useMergeEvents } from '@/api/v2/queries/event-commands';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DisabledReason } from '@/features/ux-kit/disabled-reason';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { eventNounOfAll, labelOf, PHYSICAL_TYPE_LABELS } from '@/features/ux-kit/labels';
import { useEventHubEnv } from '../use-event-hub-env';
import { AuditReasonField } from './audit-reason-field';
import { CommandError } from './command-error';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

export interface MergeDialogProps {
  events: ProductionEventView[];
  onClose: () => void;
  onDone: () => void;
}

/** Largest gap a merge may bridge (API: one day). */
const MAX_GAP_MINUTES = 1440;

/** DT09 merge of the selected events of one unit; gap policy and classification override are explicit. */
export function MergeDialog({ events, onClose, onDone }: MergeDialogProps) {
  const { number } = useNumberFormat();
  const env = useEventHubEnv();
  const merge = useMergeEvents();
  const [gapMinutes, setGapMinutes] = useState('0');
  const [override, setOverride] = useState(false);
  const [reason, setReason] = useState('');
  const ordered = [...events].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const noun = eventNounOfAll(events.map((event) => event.classification.physicalType));
  const gap = Number(gapMinutes);
  const gapValid = Number.isInteger(gap) && gap >= 0 && gap <= MAX_GAP_MINUTES;
  const blocked = !gapValid ? `Enter a gap of 0 to ${MAX_GAP_MINUTES} whole minutes.` : reason.trim() === '' ? 'Enter why (kept in the history) to continue.' : null;
  const submit = async () => {
    const body = { reason: reason.trim(), maxGapSeconds: gap * 60, overrideClassification: override };
    const result = await merge.submit({ events: ordered, body }).catch(() => null);
    if (result) onDone();
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="merge-dialog">
        <DialogHeader>
          <DialogTitle>Merge {number(events.length)} {noun}s</DialogTitle>
          <DialogDescription>One {noun} spans the union; the merged {noun}s become superseded. One unit only.</DialogDescription>
        </DialogHeader>
        <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
          {ordered.map((event) => (
            <li key={event.id}>
              <PlantTime iso={event.startTime} tz={env.timezone} withDate /> · {env.unitName(event.unitId)} · {labelOf(PHYSICAL_TYPE_LABELS, event.classification.physicalType)}
            </li>
          ))}
        </ul>
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label htmlFor="merge-gap">Largest gap to bridge (minutes, 0 = touching only)</Label>
            <Input id="merge-gap" inputMode="numeric" value={gapMinutes} onChange={(e) => setGapMinutes(e.target.value)} aria-invalid={!gapValid} />
          </div>
          <label className="flex items-center gap-2 text-sm" htmlFor="merge-override">
            <Checkbox id="merge-override" checked={override} onCheckedChange={(checked) => setOverride(checked === true)} />
            Merge different types or schedule classes (the earliest event wins)
          </label>
          <AuditReasonField id="merge-reason" value={reason} onChange={setReason} maxLength={1000} />
        </div>
        <CommandError error={merge.error} />
        <DisabledReason id="merge-blocked" reason={blocked} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={blocked !== null || merge.isPending} aria-describedby={blocked ? 'merge-blocked' : undefined} onClick={() => void submit()}>Merge</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
