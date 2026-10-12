import { useState } from 'react';
import { useMergeEvents } from '@/api/v2/queries/event-commands';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { labelOf, PHYSICAL_TYPE_LABELS } from '@/features/ux-kit/labels';
import { useEventHubEnv } from '../use-event-hub-env';
import { CommandError } from './command-error';

export interface MergeDialogProps {
  events: ProductionEventView[];
  onClose: () => void;
  onDone: () => void;
}

/** Largest gap a merge may bridge (API: one day). */
const MAX_GAP_MINUTES = 1440;

/** DT09 merge of the selected events of one unit; gap policy and classification override are explicit. */
export function MergeDialog({ events, onClose, onDone }: MergeDialogProps) {
  const env = useEventHubEnv();
  const merge = useMergeEvents();
  const [gapMinutes, setGapMinutes] = useState('0');
  const [override, setOverride] = useState(false);
  const [reason, setReason] = useState('');
  const ordered = [...events].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const gap = Number(gapMinutes);
  const gapValid = Number.isInteger(gap) && gap >= 0 && gap <= MAX_GAP_MINUTES;
  const submit = async () => {
    const body = { reason: reason.trim(), maxGapSeconds: gap * 60, overrideClassification: override };
    const result = await merge.submit({ events: ordered, body }).catch(() => null);
    if (result) onDone();
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="merge-dialog">
        <DialogHeader>
          <DialogTitle>Merge {events.length} events</DialogTitle>
          <DialogDescription>One event spans the union; the merged events become superseded. One unit only.</DialogDescription>
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
          <div className="space-y-1">
            <Label htmlFor="merge-reason">Why (kept in the history)</Label>
            <Textarea id="merge-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
          </div>
        </div>
        <CommandError error={merge.error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!gapValid || reason.trim() === '' || merge.isPending} onClick={() => void submit()}>Merge</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
