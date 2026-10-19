import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useProductionEvent } from '@/api/v2/queries/production-events';
import type { ProductionEventView } from '@/api/v2/types/events';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { useDebouncedValue } from '@/features/ux-kit/use-debounced-value';
import { ConflictDialog } from './components/conflict-dialog';
import { DraftOfferAlert } from './components/draft-offer-alert';
import { EventFormFields } from './components/event-form-fields';
import { ImpactedPeriodsPreview } from './components/impacted-periods-preview';
import { SourceOverrideBanner } from './components/source-override-banner';
import { EventHubFrame } from './event-hub-frame';
import { useBackTarget } from './hooks/use-back-target';
import { useEventForm } from './hooks/use-event-form';
import { useEventFormSubmit } from './hooks/use-event-form-submit';
import { usePlantFormat } from './hooks/use-plant-format';
import { editTitleOf } from './model/edit-title';
import { eventPageTitle } from './model/event-trail';
import { useScrollToTop } from './hooks/use-scroll-to-top';
import { impactedInterval, type EventFormValues } from './model/event-form';
import { useEventHubEnv } from './use-event-hub-env';

/**
 * `/events/new` (`?unitId=` prefills the unit) and `/events/:eventId/edit`: the event form as a page.
 * An edit waits for the live event so its revision is the draft base; the 412 review stays a dialog.
 */
export function EventFormPage() {
  const { eventId } = useParams();
  return (
    <EventHubFrame>
      <EventFormScreen key={eventId ?? 'new'} eventId={eventId ?? null} />
    </EventHubFrame>
  );
}

/** E-3: "Unit 100 · Stop from 2026-10-15 22:39" in plant time, once the event is loaded. */
function useEditTitle(event: ProductionEventView | undefined): string {
  const env = useEventHubEnv();
  const { dateTime } = usePlantFormat();
  return event ? editTitleOf(event, env.unitName, dateTime) : 'Edit event';
}

function EventFormScreen({ eventId }: { eventId: string | null }) {
  const detail = useProductionEvent(eventId);
  const [params] = useSearchParams();
  const listBack = useBackTarget();
  const editTitle = useEditTitle(detail.data);
  const env = useEventHubEnv();
  useScrollToTop(eventId ?? 'new');
  const back = eventId ? { to: `/events/${eventId}`, label: detail.data ? eventPageTitle(detail.data, env.unitName) : 'Event' } : listBack;
  return (
    <Page>
      <PageHeader title={eventId ? editTitle : 'New event'} back={back} description="Times on the plant clock; the server validates the interval and the codes." />
      <div data-testid="event-form">
        {eventId ? (
          <DataState state={dataStateOf(detail)} error={detail.error} onRetry={() => detail.refetch()}>
            {detail.data && <EventFormBody event={detail.data} backTo={back.to} />}
          </DataState>
        ) : (
          <EventFormBody event={null} defaultUnitId={params.get('unitId') ?? ''} backTo={back.to} />
        )}
      </div>
    </Page>
  );
}

interface EventFormBodyProps {
  event: ProductionEventView | null;
  defaultUnitId?: string;
  backTo: string;
}

function EventFormBody({ event, defaultUnitId = '', backTo }: EventFormBodyProps) {
  const env = useEventHubEnv();
  const navigate = useNavigate();
  // the edit replaced the event page in the history: leaving replaces it back, so Back still reaches the list
  const { state } = useLocation();
  const leave = (to: string) => navigate(to, { replace: true, state });
  const userId = useAuth().session?.user.id ?? 'anonymous';
  const form = useEventForm({ userId, tenantId: env.tenantId, event, timezone: env.timezone, defaults: { unitId: defaultUnitId } });
  const save = useEventFormSubmit({ form, event, timezone: env.timezone, onSaved: (saved) => leave(`/events/${saved.id}`) });
  // the preview query follows the typed interval once it stops changing
  const { intervalMode, startLocal, endLocal, durationMinutes } = form.values;
  const typed = useDebouncedValue(JSON.stringify({ intervalMode, startLocal, endLocal, durationMinutes }), 400);
  const interval = impactedInterval(JSON.parse(typed) as Pick<EventFormValues, 'intervalMode' | 'startLocal' | 'endLocal' | 'durationMinutes'>, env.timezone);
  const unitId = event?.unitId ?? form.values.unitId;
  const discard = () => {
    form.discard();
    leave(backTo);
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); void save.submit(); }} className="space-y-6" noValidate>
      {form.restored && <Alert data-testid="draft-restored"><AlertDescription>Unsaved changes restored from your last visit.</AlertDescription></Alert>}
      <DraftOfferAlert form={form} />
      {event && <SourceOverrideBanner event={event} />}
      {form.serverChanged && (
        <Alert data-testid="server-changed"><AlertDescription>The event changed on the server since you started; saving asks you to review the differences.</AlertDescription></Alert>
      )}
      <EventFormFields form={form} mode={event ? 'edit' : 'create'} event={event} />
      {unitId && interval && <ImpactedPeriodsPreview unitId={unitId} from={interval.from} to={interval.to ?? event?.asOf ?? null} />}
      {save.formError && <Alert variant="destructive" role="alert" data-testid="form-error"><AlertDescription>{save.formError}</AlertDescription></Alert>}
      <div className="flex flex-wrap justify-end gap-2">
        <ConfirmDialog
          trigger={<Button type="button" variant="outline">Discard</Button>}
          title="Discard your changes?"
          description="The unsaved changes of this form are removed from this browser."
          confirmLabel="Discard changes"
          destructive
          onConfirm={discard}
        />
        <Button type="button" variant="ghost" onClick={() => leave(backTo)}>Keep draft and close</Button>
        <Button type="submit" disabled={save.pending}>{save.pending ? 'Saving…' : 'Save'}</Button>
      </div>
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
