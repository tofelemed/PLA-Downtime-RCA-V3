import { useState } from 'react';
import { useSplitEvent } from '@/api/v2/queries/event-commands';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { DateTimeInput } from '@/features/ux-kit/date-inputs';
import { DisabledReason } from '@/features/ux-kit/disabled-reason';
import { eventNoun, type EventNoun } from '@/features/ux-kit/labels';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { useCalendarPreference } from '@/lib/dates';
import { useEventHubEnv } from '../use-event-hub-env';
import { AuditReasonField } from './audit-reason-field';
import { CommandError } from './command-error';

export interface SplitDialogProps {
  event: ProductionEventView;
  onClose: () => void;
  onDone: (createdIds: string[]) => void;
}

const MINUTE_MS = 60_000;
const outsideMessage = (noun: EventNoun) => `Choose a time inside the ${noun}: after its start and before its end.`;

/** Whole minutes strictly inside the event (an open event ends at the server's as-of instant). */
function splitRange(event: ProductionEventView) {
  const start = Date.parse(event.startTime);
  const end = Date.parse(event.endTime ?? event.asOf);
  const steps = Math.max(0, Math.floor((end - start) / MINUTE_MS) - 1);
  return { start, steps };
}

/** Whole minutes after `start` of a typed instant, or null when it is not strictly inside the event. */
function splitOffsetOf(iso: string | null, start: number, steps: number): number | null {
  if (!iso) return null;
  const minutes = Math.round((Date.parse(iso) - start) / MINUTE_MS);
  return minutes >= 1 && minutes <= steps ? minutes : null;
}

interface SplitAtProps {
  start: number;
  steps: number;
  offset: number;
  error: string | null;
  noun: EventNoun;
  onOffset: (offset: number, error: string | null) => void;
}

/** E-8: the split instant as a plant-time date and time, kept in step with the 1-minute slider. */
function SplitAtFields({ start, steps, offset, error, noun, onOffset }: SplitAtProps) {
  const env = useEventHubEnv();
  const preference = useCalendarPreference();
  const splitAt = new Date(start + offset * MINUTE_MS).toISOString();
  const type = (iso: string | null) => {
    const next = splitOffsetOf(iso, start, steps);
    onOffset(next ?? offset, next === null ? outsideMessage(noun) : null);
  };
  return (
    <div className="space-y-2">
      <DateTimeInput label="Split at (plant time)" value={splitAt} timeZone={env.timezone} calendar={preference.calendar} error={error} onChange={type} />
      <Label htmlFor="split-at" className="text-xs text-muted-foreground">
        or drag: <PlantTime iso={splitAt} tz={env.timezone} withDate />
      </Label>
      <Slider id="split-at" min={1} max={steps} step={1} value={[offset]} onValueChange={([value]) => onOffset(value, null)} aria-label="Split instant" />
    </div>
  );
}

/** DT09 split at an instant chosen by date and time or on a slider; the preview names the two resulting intervals. */
export function SplitDialog({ event, onClose, onDone }: SplitDialogProps) {
  const env = useEventHubEnv();
  const split = useSplitEvent();
  const { start, steps } = splitRange(event);
  const noun = eventNoun(event.classification.physicalType);
  const [offset, setOffset] = useState(Math.max(1, Math.round(steps / 2)));
  const [timeError, setTimeError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const splitAt = new Date(start + offset * MINUTE_MS).toISOString();
  const blocked = timeError ? 'Fix the split time to continue.' : (steps >= 1 && reason.trim() === '' ? 'Enter why (kept in the history) to continue.' : null);
  const submit = async () => {
    const result = await split.submit({ event, body: { splitAt, reason: reason.trim() } }).catch(() => null);
    if (result) onDone(result.createdEventIds);
  };
  const changeOffset = (next: number, error: string | null) => {
    setOffset(next);
    setTimeError(error);
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="split-dialog">
        <DialogHeader>
          <DialogTitle>Split {noun}</DialogTitle>
          <DialogDescription>Both parts keep the coding and the stop occurrence; the original becomes superseded.</DialogDescription>
        </DialogHeader>
        {steps < 1 ? (
          <p className="text-sm">The {noun} is too short to split at a whole minute.</p>
        ) : (
          <div className="space-y-4">
            <SplitAtFields start={start} steps={steps} offset={offset} error={timeError} noun={noun} onOffset={changeOffset} />
            <ul className="text-sm" data-testid="split-preview" aria-label={`Resulting ${noun}s`}>
              <li>Part 1: <PlantTime iso={event.startTime} tz={env.timezone} /> – <PlantTime iso={splitAt} tz={env.timezone} /></li>
              <li>Part 2: <PlantTime iso={splitAt} tz={env.timezone} /> – {event.endTime ? <PlantTime iso={event.endTime} tz={env.timezone} /> : 'ongoing'}</li>
            </ul>
            <AuditReasonField id="split-reason" value={reason} onChange={setReason} maxLength={1000} />
          </div>
        )}
        <CommandError error={split.error} />
        <DisabledReason id="split-blocked" reason={blocked} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={steps < 1 || blocked !== null || split.isPending} aria-describedby={blocked ? 'split-blocked' : undefined} onClick={() => void submit()}>Split</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
