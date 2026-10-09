import { useProductionEvent, useProductionEventHistory } from '@/api/v2/queries/production-events';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { DurationText } from '@/features/ux-kit/duration-text';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { humanize } from '../model/event-states';
import { useEventHubEnv } from '../use-event-hub-env';
import { EvidencePanel } from './evidence-panel';
import { ImpactedPeriodsPreview } from './impacted-periods-preview';
import { ReviewItemsList } from './review-items-list';
import { RevisionTimeline } from './revision-timeline';
import { SourceEffectiveTable } from './source-effective-table';
import { StateBadges } from './state-badges';

export type EventAction = 'edit' | 'split' | 'close';

export interface EventDetailDrawerProps {
  eventId: string | null;
  onOpenChange: (open: boolean) => void;
  onAction: (action: EventAction, event: ProductionEventView) => void;
}

/** History is append-only; superseded and retracted events are read-only (409 on any operation). */
const isOperable = (event: ProductionEventView) => event.states.physical === 'open' || event.states.physical === 'closed';

/** Detail drawer: states, interval, effective vs source, revisions, review items, evidence, periods. */
export function EventDetailDrawer({ eventId, onOpenChange, onAction }: EventDetailDrawerProps) {
  const env = useEventHubEnv();
  const detail = useProductionEvent(eventId);
  const history = useProductionEventHistory(eventId);
  const event = detail.data;
  return (
    <Sheet open={eventId !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl" data-testid="event-detail">
        <SheetHeader>
          <SheetTitle>{event ? `${humanize(event.classification.physicalType)} · ${env.unitName(event.unitId)}` : 'Event'}</SheetTitle>
          <SheetDescription>{event ? `${humanize(event.sourceKind)} event · revision ${event.rowVersion}` : 'Loading…'}</SheetDescription>
        </SheetHeader>
        <DataState state={dataStateOf(detail)} error={detail.error} onRetry={() => detail.refetch()}>
          {event && (
            <div className="mt-4 space-y-4">
              <EventSummary event={event} onAction={onAction} />
              <DetailTabs event={event} history={history} />
            </div>
          )}
        </DataState>
      </SheetContent>
    </Sheet>
  );
}

function DetailTabs({ event, history }: { event: ProductionEventView; history: ReturnType<typeof useProductionEventHistory> }) {
  const data = history.data;
  const openReviews = data?.reviewItems.filter((item) => item.state === 'open').length ?? 0;
  return (
    <Tabs defaultValue="values">
      <TabsList className="flex-wrap">
        <TabsTrigger value="values">Source vs effective</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
        <TabsTrigger value="review">Review ({openReviews})</TabsTrigger>
        <TabsTrigger value="evidence">Evidence</TabsTrigger>
        <TabsTrigger value="periods">Periods</TabsTrigger>
      </TabsList>
      <DataState state={dataStateOf(history)} error={history.error}>
        {data && (
          <>
            <TabsContent value="values"><SourceEffectiveTable revisions={data.revisions} overriddenFields={event.overriddenFields ?? []} /></TabsContent>
            <TabsContent value="history"><RevisionTimeline history={data} /></TabsContent>
            <TabsContent value="review"><ReviewItemsList event={event} items={data.reviewItems} /></TabsContent>
            <TabsContent value="evidence"><EvidencePanel history={data} /></TabsContent>
          </>
        )}
      </DataState>
      <TabsContent value="periods">
        <ImpactedPeriodsPreview unitId={event.unitId} from={event.startTime} to={event.endTime ?? event.asOf} />
      </TabsContent>
    </Tabs>
  );
}

function EventSummary({ event, onAction }: { event: ProductionEventView; onAction: EventDetailDrawerProps['onAction'] }) {
  const env = useEventHubEnv();
  return (
    <>
      <StateBadges states={event.states} legacyStatus={event.status} />
      <dl className="grid grid-cols-[8rem_1fr] gap-1 text-sm">
        <dt className="text-muted-foreground">Start</dt>
        <dd><PlantTime iso={event.startTime} tz={env.timezone} withDate /></dd>
        <dt className="text-muted-foreground">End</dt>
        <dd>{event.endTime ? <PlantTime iso={event.endTime} tz={env.timezone} withDate /> : 'Running'}</dd>
        <dt className="text-muted-foreground">{event.isOpen ? 'Elapsed' : 'Duration'}</dt>
        <dd data-testid="detail-duration"><DurationText seconds={event.isOpen ? event.elapsedSeconds : event.durationSeconds} /></dd>
        <dt className="text-muted-foreground">Reason</dt>
        <dd>{env.reasonName(event.reasonCodeId)}</dd>
        <dt className="text-muted-foreground">Description</dt>
        <dd>{event.description ?? '—'}</dd>
      </dl>
      {isOperable(event) && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onAction('edit', event)}>Edit / code</Button>
          <Button size="sm" variant="outline" onClick={() => onAction('split', event)}>Split</Button>
          {event.isOpen && <Button size="sm" variant="outline" onClick={() => onAction('close', event)}>Close stop</Button>}
        </div>
      )}
    </>
  );
}
