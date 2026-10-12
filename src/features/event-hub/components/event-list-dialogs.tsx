import type { ProductionEventView } from '@/api/v2/types/events';
import type { EventHubDialog } from '../hooks/use-event-hub-state';
import { BulkCodeDialog } from './bulk-code-dialog';
import { CloseStopDialog } from './close-stop-dialog';
import { MergeDialog } from './merge-dialog';

export interface EventListDialogsProps {
  dialog: EventHubDialog;
  selectedEvents: ProductionEventView[];
  onClose: () => void;
  /** after an operation that superseded events: drop the selection */
  onSettled: () => void;
}

/** The one short dialog of the list page open at a time (close a stop, merge, bulk code). */
export function EventListDialogs({ dialog, selectedEvents, onClose, onSettled }: EventListDialogsProps) {
  if (!dialog) return null;
  const settle = () => {
    onClose();
    onSettled();
  };
  switch (dialog.kind) {
    case 'close':
      return <CloseStopDialog event={dialog.event} onClose={onClose} onDone={settle} />;
    case 'merge':
      return <MergeDialog events={selectedEvents} onClose={onClose} onDone={settle} />;
    case 'bulk':
      return <BulkCodeDialog events={selectedEvents} onClose={onClose} />;
    default:
      return null;
  }
}
