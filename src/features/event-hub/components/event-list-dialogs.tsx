import type { EventSelectionQuery } from '@/api/v2/queries/production-events';
import type { ProductionEventView } from '@/api/v2/types/events';
import type { EventHubDialog } from '../hooks/use-event-hub-state';
import { BulkCodeDialog } from './bulk-code-dialog';
import { CloseStopDialog } from './close-stop-dialog';
import { CodeEventDialog } from './code-event-dialog';
import { MergeDialog } from './merge-dialog';
import { SelectAllMatchingDialog } from './select-all-matching-dialog';

export interface EventListDialogsProps {
  dialog: EventHubDialog;
  selectedEvents: ProductionEventView[];
  onClose: () => void;
  /** after an operation that changed the selected events (merge, bulk coding): drop the selection */
  onSettled: () => void;
  /** after a single-row command: only that event leaves the selection (its row version moved on) */
  onEventChanged: (eventId: string) => void;
  /** the list filters as a selection query ("all matching", SME D13) */
  selection: EventSelectionQuery | null;
  onOpen: (dialog: EventHubDialog) => void;
}

/**
 * The one short dialog of the list page open at a time (close a stop, code one stop, merge, bulk code).
 * E-6: a bulk apply clears the selection (its row versions are stale); a single-row Code or Close keeps
 * the rest of the selection.
 */
export function EventListDialogs({ dialog, selectedEvents, onClose, onSettled, onEventChanged, selection, onOpen }: EventListDialogsProps) {
  if (!dialog) return null;
  const settle = () => {
    onClose();
    onSettled();
  };
  const changed = (eventId: string) => () => {
    onClose();
    onEventChanged(eventId);
  };
  switch (dialog.kind) {
    case 'close':
      return <CloseStopDialog event={dialog.event} onClose={onClose} onDone={changed(dialog.event.id)} />;
    case 'code':
      return <CodeEventDialog event={dialog.event} onClose={onClose} onDone={changed(dialog.event.id)} />;
    case 'merge':
      return <MergeDialog events={selectedEvents} onClose={onClose} onDone={settle} />;
    case 'bulk':
      return <BulkCodeDialog events={dialog.targets ?? selectedEvents} onClose={onClose} onApplied={onSettled} />;
    case 'select-all':
      return <SelectAllMatchingDialog query={selection} onClose={onClose} onConfirm={(targets) => onOpen({ kind: 'bulk', targets })} />;
    default:
      return null;
  }
}
