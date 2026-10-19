import { useLocation, useNavigate } from 'react-router-dom';
import { useEventLosses } from '@/api/v2/queries/pla-analytics';
import { usePagedQuery } from '@/api/v2/queries/use-paged-query';
import type { QueryParams } from '@/api/v2/request-url';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { humanize } from '@/features/ux-kit/labels';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DurationText } from '@/features/ux-kit/duration-text';
import { labelOf, PHYSICAL_TYPE_LABELS } from '@/features/ux-kit/labels';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { Quantity } from '@/features/ux-kit/quantity';
import { useEventHubEnv, type EventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { EventRcaChip } from '@/features/rca/components/event-rca-chip';
import { StartRcaLink } from '@/features/rca/components/start-rca-link';
import { SELECT_CLASS } from '../components/analytics-filters';
import { eventLossQuery, LOSS_EVENT_TYPES, lossEventsQuery, type AnalyticsScope, type LossEventType } from '../model/analytics-scope';
import { eventLossesOf, type EventLoss } from '../model/event-losses';
import { LOSS_EVENT_TYPE_LABELS } from '../model/display';

function AttributedLoss({ losses }: { losses: readonly EventLoss[] | undefined }) {
  if (!losses?.length) return <span title="No loss line of the shown periods is attributed to this event">—</span>;
  return (
    <span data-testid="event-attributed-loss">
      {losses.map((loss, i) => (
        <span key={loss.uom ?? '-'}>
          {i > 0 && ' · '}
          <Quantity value={loss.amount} uom={loss.uom} />
        </span>
      ))}
    </span>
  );
}

function columnsOf(env: EventHubEnv, losses: ReadonlyMap<string, EventLoss[]>): Array<DataTableColumn<ProductionEventView>> {
  return [
    { id: 'start', header: 'Start', nowrap: true, cell: (e) => <PlantTime iso={e.startTime} tz={env.timezone} withDate /> },
    { id: 'unit', header: 'Unit', cell: (e) => env.unitName(e.unitId) },
    { id: 'type', header: 'Type', cell: (e) => labelOf(PHYSICAL_TYPE_LABELS, e.classification.physicalType) },
    { id: 'reason', header: 'Reason', cell: (e) => (e.reasonCodeId ? env.reasonName(e.reasonCodeId) : 'Not coded') },
    { id: 'duration', header: 'Duration', align: 'right', nowrap: true, cell: (e) => (e.durationSeconds === null ? 'Ongoing' : <DurationText seconds={e.durationSeconds} />) },
    { id: 'quantity', header: 'Lost quantity (attributed)', align: 'right', nowrap: true, cell: (e) => <AttributedLoss losses={losses.get(e.id)} /> },
    {
      id: 'rca',
      header: 'RCA',
      cell: (e) => (
        <span className="flex flex-wrap items-center gap-1">
          <EventRcaChip rcaState={e.states.rca} caseId={e.rcaId} />
          {!e.rcaId && <StartRcaLink context={{ eventId: e.id }} label={`Start investigation for the ${labelOf(PHYSICAL_TYPE_LABELS, e.classification.physicalType).toLowerCase()} on ${env.unitName(e.unitId)}`} />}
        </span>
      ),
    },
  ];
}

export interface LossEventsProps {
  scope: AnalyticsScope;
  onChange: (patch: Partial<AnalyticsScope>) => void;
}

/**
 * The loss events behind the figures (the v1 "loss event drill-down"): stops, slowdowns and quality losses
 * of the scope's units overlapping the window, newest first, 20 per page from the server keyset list.
 * Lost quantity is the loss attributed to the event by the periods' loss lines (approved, else the draft),
 * the same lines as the loss tree. A row opens the event's page in the Event Hub.
 */
export function LossEvents({ scope, onChange }: LossEventsProps) {
  const env = useEventHubEnv();
  const navigate = useNavigate();
  const location = useLocation();
  const { from, to, unitIds, ...filters } = lossEventsQuery(scope);
  const losses = useEventLosses(eventLossQuery(scope), env.timezone);
  const events = usePagedQuery<ProductionEventView>({
    resource: 'production-events',
    path: '/production-events',
    query: lossEventsQuery(scope) as QueryParams,
    key: { scope: { unitIds }, window: { from, to }, filters },
  });
  return (
    <div className="space-y-2" data-testid="loss-events">
      <div className="flex items-center gap-2">
        <Label htmlFor="loss-event-type">Show</Label>
        <select id="loss-event-type" data-testid="loss-event-type" className={SELECT_CLASS} value={scope.eventType} onChange={(e) => onChange({ eventType: e.target.value as LossEventType })}>
          {LOSS_EVENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {LOSS_EVENT_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        {scope.eventOee !== 'all' && (
          <span className="flex items-center gap-1 text-sm" data-testid="loss-event-oee" data-oee={scope.eventOee}>
            OEE component: {humanize(scope.eventOee)}
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ eventOee: 'all' })}>
              Show all components
            </Button>
          </span>
        )}
      </div>
      <DataTable
        caption="Loss events of this scope"
        columns={columnsOf(env, eventLossesOf(losses.data?.data))}
        rows={events.rows}
        getRowKey={(e) => e.id}
        pager={events.pager}
        status={events.status}
        empty={{ text: 'No loss events in this window.' }}
        onRowClick={(e) => navigate(`/events/${e.id}`, { state: { listSearch: `${location.pathname}${location.search}` } })}
        rowLabel={(e) => `${labelOf(PHYSICAL_TYPE_LABELS, e.classification.physicalType)} on ${env.unitName(e.unitId)}`}
        density="compact"
      />
    </div>
  );
}
