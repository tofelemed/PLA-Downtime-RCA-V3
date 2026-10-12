import { useState } from 'react';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { ActionIcon } from '@/lib/icons';
import { useRetractEvent } from '../hooks/use-retract-event';
import { CommandError } from './command-error';

/**
 * Retract a manually entered event (the v1 "Delete"): confirmed with a reason; the event stays in the
 * history as "Retracted" and leaves the figures on the next recalculation.
 */
export function RetractEventDialog({ event, onDone }: { event: ProductionEventView; onDone: () => void }) {
  const retract = useRetractEvent();
  const [reason, setReason] = useState('');
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
      title="Retract this event?"
      description="It stays in the history as retracted and no longer counts in downtime or losses. This cannot be undone."
      confirmLabel="Retract event"
      destructive
      confirmDisabled={reason.trim() === ''}
      onConfirm={confirm}
    >
      <div className="space-y-1">
        <Label htmlFor="retract-reason">Why (kept in the history)</Label>
        <Textarea id="retract-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
      </div>
      <CommandError error={retract.error} />
    </ConfirmDialog>
  );
}
