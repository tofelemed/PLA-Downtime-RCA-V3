import { lazy, Suspense, useState } from 'react';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { Skeleton } from '@/components/ui/skeleton';
import { DataState } from '@/features/ux-kit/data-state';
import { CurrentStopsPanel } from '@/features/event-hub/components/current-stops-panel';
import { EventDetailDrawer } from '@/features/event-hub/components/event-detail-drawer';
import { EventHubDialogs } from '@/features/event-hub/components/event-hub-dialogs';
import { EventHubEnvProvider } from '@/features/event-hub/event-hub-env';
import { defaultFilters } from '@/features/event-hub/model/event-filters';
import { BadActors } from './components/bad-actors';
import { CalendarComparison } from './components/calendar-comparison';
import { CrewComparison } from './components/crew-comparison';
import { DowntimeFiltersBar } from './components/downtime-filters-bar';
import { DowntimeHeader } from './components/downtime-header';
import { DrillEvents } from './components/drill-events';
import { KpiSummary } from './components/kpi-summary';
import { ReasonPareto } from './components/reason-pareto';
import { ReliabilityCard } from './components/reliability-card';
import { TrendPanel } from './components/trend-panel';
import { useDowntimeFilters } from './hooks/use-downtime-filters';
import { useEventActions, type EventActions } from './hooks/use-event-actions';
import { toSearchParams, type DowntimeFilters } from './model/downtime-filters';
import type { DrillSelection } from './model/reason-drill';

const StateTimeline = lazy(() => import('./components/state-timeline').then((module) => ({ default: module.StateTimeline })));

/**
 * Downtime Analysis (plan 3.3, AN01) behind the `v2.downtimeAnalysis` flag: what is down, why, how
 * often, where and whether it is improving — every figure from the v2 report read models, filters in
 * the URL, drill-through to the events of the same scope.
 */
export function DowntimeAnalysisPage() {
  const tenantId = useV2TenantId();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant (tenant) to analyse its downtime." />;
  return (
    <EventHubEnvProvider tenantId={tenantId}>
      <DowntimeScreen />
    </EventHubEnvProvider>
  );
}

function DowntimeScreen() {
  const { filters, change } = useDowntimeFilters();
  const actions = useEventActions();
  const filterKey = toSearchParams(filters).toString();
  const [drill, setDrill] = useState<{ key: string; selection: DrillSelection } | null>(null);
  const selection = drill && drill.key === filterKey ? drill.selection : null;
  return (
    <div className="space-y-4" data-testid="downtime-analysis">
      <DowntimeHeader filters={filters} />
      <DowntimeFiltersBar filters={filters} onChange={change} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <KpiSummary filters={filters} />
          <ReliabilityCard filters={filters} />
        </div>
        <CurrentlyDown filters={filters} actions={actions} />
      </div>
      <ReasonPareto filters={filters} onChange={change} onEvents={(next) => setDrill({ key: filterKey, selection: next })} />
      {selection && <DrillEvents filters={filters} selection={selection} onOpen={actions.openDetail} onDismiss={() => setDrill(null)} />}
      <TrendPanel filters={filters} />
      <div className="grid gap-4 lg:grid-cols-2">
        <BadActors filters={filters} />
        <CrewComparison filters={filters} />
      </div>
      <CalendarComparison filters={filters} />
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <StateTimeline filters={filters} onOpen={actions.openDetail} />
      </Suspense>
      <EventDetailDrawer
        eventId={actions.detailId}
        onOpenChange={(open) => !open && actions.openDetail(null)}
        onAction={(action, event) => actions.openDialog(action === 'edit' ? { kind: 'form', eventId: event.id } : { kind: action, event })}
      />
      <EventHubDialogs dialog={actions.dialog} selectedEvents={[]} defaultUnitId="" onClose={actions.closeDialog} onSettled={actions.settle} />
    </div>
  );
}

/** Currently down (AN01): the 3.2 current-stops panel for the same units — elapsed as of the server. */
function CurrentlyDown({ filters, actions }: { filters: DowntimeFilters; actions: EventActions }) {
  const stopsFilter = { ...defaultFilters({ from: filters.from, to: filters.to, label: filters.windowLabel }), unitIds: filters.unitIds };
  return <CurrentStopsPanel filters={stopsFilter} onOpen={actions.openDetail} onClose={(event) => actions.openDialog({ kind: 'close', event })} />;
}
