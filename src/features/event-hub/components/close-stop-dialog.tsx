import { useState } from 'react';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DateTimeInput } from '@/features/ux-kit/date-inputs';
import { DisabledReason } from '@/features/ux-kit/disabled-reason';
import { useCalendarPreference } from '@/lib/dates';
import { useCloseStop } from '../hooks/use-code-and-close';
import { usePlantFormat } from '../hooks/use-plant-format';
import { AuditReasonField } from './audit-reason-field';
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
  const blocked = !endTime ? 'Enter the end time to continue.' : reason.trim() === '' ? 'Enter why (kept in the history) to continue.' : null;
  const submit = async () => {
    if (!endTime) return;
    if (await close.submit({ endTime, reason, reasonCodeId })) onDone();
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="close-dialog">
        <DialogHeader>
          <DialogTitle>Close stop</DialogTitle>
          <DialogDescription>Ongoing since {dateTime(event.startTime)}. Closing is not approving.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <DateTimeInput label={`End (plant time, ${timezone})`} value={endTime} timeZone={timezone} calendar={preference.calendar} onChange={setEndTime} required />
          <ReasonCodeSelect id="close-reason-code" value={reasonCodeId} onChange={setReasonCodeId} allowEmpty={!event.reasonCodeId} />
          <AuditReasonField id="close-reason" value={reason} onChange={setReason} maxLength={1000} />
        </div>
        <CommandError error={close.error} />
        <DisabledReason id="close-blocked" reason={blocked} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={blocked !== null || close.pending} aria-describedby={blocked ? 'close-blocked' : undefined} onClick={() => void submit()}>
            {reasonCodeId && reasonCodeId !== event.reasonCodeId ? 'Code and close' : 'Close stop'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
