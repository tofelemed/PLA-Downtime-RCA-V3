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
  /** after an operation that superseded events: drop the selection */
  onSettled: () => void;
  /** the list filters as a selection query ("all matching", SME D13) */
  selection: EventSelectionQuery | null;
  onOpen: (dialog: EventHubDialog) => void;
}

/** The one short dialog of the list page open at a time (close a stop, code one stop, merge, bulk code). */
export function EventListDialogs({ dialog, selectedEvents, onClose, onSettled, selection, onOpen }: EventListDialogsProps) {
  if (!dialog) return null;
  const settle = () => {
    onClose();
    onSettled();
  };
  switch (dialog.kind) {
    case 'close':
      return <CloseStopDialog event={dialog.event} onClose={onClose} onDone={settle} />;
    case 'code':
      return <CodeEventDialog event={dialog.event} onClose={onClose} onDone={settle} />;
    case 'merge':
      return <MergeDialog events={selectedEvents} onClose={onClose} onDone={settle} />;
    case 'bulk':
      return <BulkCodeDialog events={dialog.targets ?? selectedEvents} onClose={onClose} />;
    case 'select-all':
      return <SelectAllMatchingDialog query={selection} onClose={onClose} onConfirm={(targets) => onOpen({ kind: 'bulk', targets })} />;
    default:
      return null;
  }
}
