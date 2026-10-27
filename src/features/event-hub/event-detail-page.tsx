import { Link, useParams } from 'react-router-dom';
import { useProductionEvent, useProductionEventHistory } from '@/api/v2/queries/production-events';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EventRcaPanel } from '@/features/rca/event-rca-panel';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { eventNoun, labelOf, SOURCE_KIND_LABELS } from '@/features/ux-kit/labels';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { DisplayCurrencyToggle } from '@/features/display-currency/display-currency-toggle';
import { AttributedLossesCard } from './components/attributed-losses-card';
import { DayAccountingCard } from './components/day-accounting-card';
import { accountingHrefOf } from './model/accounting-link';
import { EventDetailActions } from './components/event-detail-actions';
import { EventDetailTabs } from './components/event-detail-tabs';
import { EventSummary } from './components/event-summary';
import { EventVerificationPanel } from './components/event-verification-panel';
import { EventHubFrame } from './event-hub-frame';
import { useBackTarget } from './hooks/use-back-target';
import { useScrollToTop } from './hooks/use-scroll-to-top';
import { eventHeaderDescription } from './model/event-header';
import { eventPageTitle, eventTrail } from './model/event-trail';
import { latestRevisionNumber } from './model/source-facts';
import { useEventHubEnv } from './use-event-hub-env';

/** `/events/:eventId`: one production event as a page (summary, attributed losses, commands, RCA, tabs). */
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
  const history = useProductionEventHistory(eventId);
  const event = detail.data;
  const latestRevision = latestRevisionNumber(history.data?.revisions ?? []);
  const title = event ? eventPageTitle(event, env.unitName) : 'Event';
  useScrollToTop(eventId);
  return (
    <Page>
      <div className="space-y-6" data-testid="event-detail">
        <PageHeader
          title={title}
          back={back}
          breadcrumbs={eventTrail(back, title)}
          description={event ? eventHeaderDescription(labelOf(SOURCE_KIND_LABELS, event.sourceKind), latestRevision) : undefined}
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
            This {eventNoun(event.classification.physicalType)} was replaced by a split or merge.{' '}
            <Link className="underline" to={`/events/${event.supersededByEventId}`}>Open the newer {eventNoun(event.classification.physicalType)}</Link>
          </AlertDescription>
        </Alert>
      )}
      <Section title="Summary">
        <EventSummary event={event} />
      </Section>
      <Section title="Attributed losses" description="Loss lines of the periods this event touched, as accounted" actions={<DisplayCurrencyToggle />}>
        <AttributedLossesCard eventId={event.id} accountingHref={accountingHrefOf(event)} />
      </Section>
      <Section title="Day accounting" description="The accounting statement of the production day this event belongs to">
        <DayAccountingCard event={event} />
      </Section>
      {event.classification.physicalType === 'downtime' && event.verification && (
        <Section title="Coding verification">
          <EventVerificationPanel event={event} />
        </Section>
      )}
      <EventRcaPanel event={event} timezone={timezone} />
      <Section title="Details">
        <EventDetailTabs event={event} />
      </Section>
    </>
  );
}
