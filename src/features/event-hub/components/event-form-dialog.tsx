import { useProductionEvent } from '@/api/v2/queries/production-events';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { useDebouncedValue } from '@/features/ux-kit/use-debounced-value';
import type { EventFormValues } from '../model/event-form';
import { plantLocalToUtc } from '../model/plant-local-time';
import { useEventForm } from '../hooks/use-event-form';
import { useEventFormSubmit } from '../hooks/use-event-form-submit';
import { useEventHubEnv } from '../use-event-hub-env';
import { ConflictDialog } from './conflict-dialog';
import { EventFormFields } from './event-form-fields';
import { ImpactedPeriodsPreview } from './impacted-periods-preview';

export interface EventFormDialogProps {
  /** null = create a manual event */
  eventId: string | null;
  defaults?: Partial<EventFormValues>;
  onClose: () => void;
  onSaved: (event: ProductionEventView) => void;
}

/** Create / edit dialog; an edit waits for the live event so its revision is the draft base. */
export function EventFormDialog({ eventId, defaults, onClose, onSaved }: EventFormDialogProps) {
  const detail = useProductionEvent(eventId);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" data-testid="event-form">
        <DialogHeader>
          <DialogTitle>{eventId ? 'Edit / code event' : 'New event'}</DialogTitle>
          <DialogDescription>Times on the plant clock; the server validates the interval and the codes.</DialogDescription>
        </DialogHeader>
        {eventId ? (
          <DataState state={dataStateOf(detail)} error={detail.error}>
            {detail.data && <EventFormBody event={detail.data} onClose={onClose} onSaved={onSaved} />}
          </DataState>
        ) : (
          <EventFormBody event={null} defaults={defaults} onClose={onClose} onSaved={onSaved} />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface EventFormBodyProps {
  event: ProductionEventView | null;
  defaults?: Partial<EventFormValues>;
  onClose: () => void;
  onSaved: (event: ProductionEventView) => void;
}

function EventFormBody({ event, defaults, onClose, onSaved }: EventFormBodyProps) {
  const env = useEventHubEnv();
  const form = useEventForm({ tenantId: env.tenantId, event, timezone: env.timezone, defaults });
  const save = useEventFormSubmit({ form, event, timezone: env.timezone, onSaved });
  // the preview query follows the typed interval once it stops changing
  const startLocal = useDebouncedValue(form.values.startLocal, 400);
  const endLocal = useDebouncedValue(form.values.endLocal, 400);
  const start = plantLocalToUtc(startLocal, env.timezone);
  const end = endLocal ? plantLocalToUtc(endLocal, env.timezone) : null;
  const unitId = event?.unitId ?? form.values.unitId;
  const discard = () => {
    form.discard();
    onClose();
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); void save.submit(); }} className="space-y-4" noValidate>
      {form.restored && <Alert data-testid="draft-restored"><AlertDescription>Unsaved changes restored from this tab.</AlertDescription></Alert>}
      {form.serverChanged && (
        <Alert data-testid="server-changed"><AlertDescription>The event changed on the server since you started; saving asks you to review the differences.</AlertDescription></Alert>
      )}
      <EventFormFields form={form} mode={event ? 'edit' : 'create'} />
      {unitId && start && <ImpactedPeriodsPreview unitId={unitId} from={start} to={end ?? event?.asOf ?? null} />}
      {save.formError && <Alert variant="destructive" role="alert" data-testid="form-error"><AlertDescription>{save.formError}</AlertDescription></Alert>}
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={discard}>Discard</Button>
        <Button type="button" variant="ghost" onClick={onClose}>Keep draft and close</Button>
        <Button type="submit" disabled={save.pending}>{save.pending ? 'Saving…' : 'Save'}</Button>
      </DialogFooter>
      {event && (
        <ConflictDialog
          open={save.conflict}
          eventId={event.id}
          draft={form.draft}
          onApplyMine={(latest) => void save.retryOn(latest)}
          onDiscardMine={discard}
          onCancel={save.dismissConflict}
        />
      )}
    </form>
  );
}
