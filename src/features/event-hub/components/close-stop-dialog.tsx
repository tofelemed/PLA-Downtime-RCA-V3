import { useState } from 'react';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DateTimeInput } from '@/features/ux-kit/date-inputs';
import { useCalendarPreference } from '@/lib/dates';
import { useCloseStop } from '../hooks/use-code-and-close';
import { usePlantFormat } from '../hooks/use-plant-format';
import { CommandError } from './command-error';
import { ReasonCodeSelect } from './reason-code-select';

export interface CloseStopDialogProps {
  event: ProductionEventView;
  onClose: () => void;
  onDone: () => void;
}

/**
 * DT10 close of a running stop; the server refuses an end before the start or in the future (422). The
 * reason code can be set in the same dialog (FE-06): it is saved first, then the stop is closed.
 */
export function CloseStopDialog({ event, onClose, onDone }: CloseStopDialogProps) {
  const { dateTime, timezone } = usePlantFormat();
  const preference = useCalendarPreference();
  const close = useCloseStop(event);
  const [endTime, setEndTime] = useState<string | null>(event.asOf);
  const [reasonCodeId, setReasonCodeId] = useState(event.reasonCodeId ?? '');
  const [reason, setReason] = useState('');
  const submit = async () => {
    if (!endTime) return;
    if (await close.submit({ endTime, reason, reasonCodeId })) onDone();
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="close-dialog">
        <DialogHeader>
          <DialogTitle>Close stop</DialogTitle>
          <DialogDescription>Running since {dateTime(event.startTime)}. Closing is not approving.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <DateTimeInput label={`End (plant time, ${timezone})`} value={endTime} timeZone={timezone} calendar={preference.calendar} onChange={setEndTime} required />
          <ReasonCodeSelect id="close-reason-code" value={reasonCodeId} onChange={setReasonCodeId} allowEmpty={!event.reasonCodeId} />
          <div className="space-y-1">
            <Label htmlFor="close-reason">Why (kept in the history)</Label>
            <Textarea id="close-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
          </div>
        </div>
        <CommandError error={close.error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!endTime || reason.trim() === '' || close.pending} onClick={() => void submit()}>
            {reasonCodeId && reasonCodeId !== event.reasonCodeId ? 'Code and close' : 'Close stop'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
