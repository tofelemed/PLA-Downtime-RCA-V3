import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ActionIcon } from '@/lib/icons';
import { CloseStopDialog } from './close-stop-dialog';
import { RetractEventDialog } from './retract-event-dialog';
import { SplitDialog } from './split-dialog';

/** History is append-only; superseded and retracted events are read-only (409 on any operation). */
const isOperable = (event: ProductionEventView) => event.states.physical === 'open' || event.states.physical === 'closed';

/**
 * Commands of an event page: Edit / code (sub-page), Split and Close stop (short dialogs), Retract
 * (confirmation, manual events only). Hidden for read-only roles and for replaced or retracted events.
 */
export function EventDetailActions({ event }: { event: ProductionEventView }) {
  const { canWriteEvents } = useCapabilities();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [dialog, setDialog] = useState<'split' | 'close' | null>(null);
  if (!canWriteEvents || !isOperable(event)) return null;
  const close = () => setDialog(null);
  return (
    <>
      <Button size="sm" onClick={() => navigate(`/events/${event.id}/edit`, { replace: true, state })}>
        <ActionIcon.edit aria-hidden className="mr-1 h-4 w-4" />
        Edit / code
      </Button>
      <Button size="sm" variant="outline" onClick={() => setDialog('split')}>Split</Button>
      {event.isOpen && <Button size="sm" variant="outline" onClick={() => setDialog('close')}>Close stop</Button>}
      {event.sourceKind === 'manual' && <RetractEventDialog event={event} onDone={() => undefined} />}
      {dialog === 'split' && (
        <SplitDialog event={event} onClose={close} onDone={(ids) => (ids[0] ? navigate(`/events/${ids[0]}`, { replace: true, state }) : close())} />
      )}
      {dialog === 'close' && <CloseStopDialog event={event} onClose={close} onDone={close} />}
    </>
  );
}
