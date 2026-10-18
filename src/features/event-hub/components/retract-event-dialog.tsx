import { useState } from 'react';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { eventNoun } from '@/features/ux-kit/labels';
import { ActionIcon } from '@/lib/icons';
import { useRetractEvent } from '../hooks/use-retract-event';
import { AuditReasonField } from './audit-reason-field';
import { CommandError } from './command-error';

/**
 * Retract a manually entered event (the v1 "Delete"): confirmed with a reason; the event stays in the
 * history as "Retracted" and leaves the figures on the next recalculation.
 */
export function RetractEventDialog({ event, onDone }: { event: ProductionEventView; onDone: () => void }) {
  const retract = useRetractEvent();
  const [reason, setReason] = useState('');
  const noun = eventNoun(event.classification.physicalType);
  const confirm = async () => {
    await retract.submit({ event, reason: reason.trim() });
    onDone();
  };
  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="outline" className="text-destructive" data-testid="retract-event">
          <ActionIcon.delete aria-hidden className="mr-1 h-4 w-4" />
          Retract
        </Button>
      }
      title={`Retract this ${noun}?`}
      description="It stays in the history as retracted and no longer counts in downtime or losses. This cannot be undone."
      confirmLabel={`Retract ${noun}`}
      destructive
      confirmDisabled={reason.trim() === ''}
      confirmDisabledReason="Enter why (kept in the history) to continue."
      onConfirm={confirm}
    >
      <AuditReasonField id="retract-reason" value={reason} onChange={setReason} maxLength={500} />
      <CommandError error={retract.error} />
    </ConfirmDialog>
  );
}
