import type { ProductionEventView } from '@/api/v2/types/events';
import type { EventHubDialog } from '../hooks/use-event-hub-state';
import { BulkCodeDialog } from './bulk-code-dialog';
import { CloseStopDialog } from './close-stop-dialog';
import { EventFormDialog } from './event-form-dialog';
import { MergeDialog } from './merge-dialog';
import { SplitDialog } from './split-dialog';

export interface EventHubDialogsProps {
  dialog: EventHubDialog;
  selectedEvents: ProductionEventView[];
  /** prefill of a new event: the single unit chosen in the filters */
  defaultUnitId: string;
  onClose: () => void;
  /** after an operation that superseded events: drop the selection and the open drawer */
  onSettled: (openEventId: string | null) => void;
}

/** The one dialog open at a time; each is mounted fresh so its form state starts from the server data. */
export function EventHubDialogs({ dialog, selectedEvents, defaultUnitId, onClose, onSettled }: EventHubDialogsProps) {
  if (!dialog) return null;
  switch (dialog.kind) {
    case 'form':
      return (
        <EventFormDialog
          key={dialog.eventId ?? 'new'}
          eventId={dialog.eventId}
          defaults={{ unitId: defaultUnitId }}
          onClose={onClose}
          onSaved={(event) => onSettled(event.id)}
        />
      );
    case 'split':
      return <SplitDialog event={dialog.event} onClose={onClose} onDone={(ids) => onSettled(ids[0] ?? null)} />;
    case 'close':
      return <CloseStopDialog event={dialog.event} onClose={onClose} onDone={() => onSettled(dialog.event.id)} />;
    case 'merge':
      return <MergeDialog events={selectedEvents} onClose={onClose} onDone={() => onSettled(null)} />;
    case 'bulk':
      return <BulkCodeDialog events={selectedEvents} onClose={onClose} />;
    default:
      return null;
  }
}
