import { Link, useParams } from 'react-router-dom';
import { useProductionEvent } from '@/api/v2/queries/production-events';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EventRcaPanel } from '@/features/rca/event-rca-panel';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { labelOf, PHYSICAL_TYPE_LABELS, SOURCE_KIND_LABELS } from '@/features/ux-kit/labels';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { EventDetailActions } from './components/event-detail-actions';
import { EventDetailTabs } from './components/event-detail-tabs';
import { EventSummary } from './components/event-summary';
import { EventHubFrame } from './event-hub-frame';
import { useBackTarget } from './hooks/use-back-target';
import { useEventHubEnv } from './use-event-hub-env';

/** `/events/:eventId`: one production event as a page (summary, commands, RCA, five tabs). */
export function EventDetailPage() {
  const { eventId = '' } = useParams();
  return (
    <EventHubFrame>
      <EventDetailScreen key={eventId} eventId={eventId} />
    </EventHubFrame>
  );
}

function EventDetailScreen({ eventId }: { eventId: string }) {
  const env = useEventHubEnv();
  const back = useBackTarget();
  const detail = useProductionEvent(eventId);
  const event = detail.data;
  const title = event ? `${labelOf(PHYSICAL_TYPE_LABELS, event.classification.physicalType)} · ${env.unitName(event.unitId)}` : 'Event';
  return (
    <Page>
      <div className="space-y-6" data-testid="event-detail">
        <PageHeader
          title={title}
          back={back}
          description={event ? `${labelOf(SOURCE_KIND_LABELS, event.sourceKind)} · revision ${event.rowVersion}` : undefined}
          actions={event ? <EventDetailActions event={event} /> : undefined}
        />
        <DataState state={dataStateOf(detail)} error={detail.error} onRetry={() => detail.refetch()}>
          {event && <EventBody event={event} timezone={env.timezone} />}
        </DataState>
      </div>
    </Page>
  );
}

function EventBody({ event, timezone }: { event: ProductionEventView; timezone: string }) {
  return (
    <>
      {event.supersededByEventId && (
        <Alert>
          <AlertDescription>
            This event was replaced by a split or merge.{' '}
            <Link className="underline" to={`/events/${event.supersededByEventId}`}>Open the newer event</Link>
          </AlertDescription>
        </Alert>
      )}
      <Section title="Summary">
        <EventSummary event={event} />
      </Section>
      <EventRcaPanel event={event} timezone={timezone} />
      <Section title="Details">
        <EventDetailTabs event={event} />
      </Section>
    </>
  );
}
