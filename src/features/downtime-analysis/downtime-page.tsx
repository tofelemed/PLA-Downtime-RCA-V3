import { lazy, Suspense, useMemo, useState } from 'react';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Skeleton } from '@/components/ui/skeleton';
import { CloseStopDialog } from '@/features/event-hub/components/close-stop-dialog';
import { CurrentStopsPanel } from '@/features/event-hub/components/current-stops-panel';
import { EventHubFrame } from '@/features/event-hub/event-hub-frame';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { Page } from '@/features/ux-kit/page-layout';
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
import { useDowntimeBundle } from './hooks/use-downtime-bundle';
import { useDowntimeFilters } from './hooks/use-downtime-filters';
import { bundleQuery, pageViews } from './model/bundle-views';
import { toSearchParams } from './model/downtime-filters';
import type { DrillSelection } from './model/reason-drill';

const StateTimeline = lazy(() => import('./components/state-timeline').then((module) => ({ default: module.StateTimeline })));

/**
 * Downtime Analysis (plan 3.3, AN01): what is down, why, how often, where and whether it is improving.
 * The summary, bad actors, crews and trend share one bundle response (T24, one request); the Pareto,
 * reliability and the previous-window column are their own reads. Filters live in the URL; events open
 * as their own page and Back returns here.
 */
export function DowntimeAnalysisPage() {
  return (
    <EventHubFrame noTenantText="Choose a plant to analyse its downtime.">
      <DowntimeScreen />
    </EventHubFrame>
  );
}

function DowntimeScreen() {
  const env = useEventHubEnv();
  const { filters, change } = useDowntimeFilters();
  const filterKey = toSearchParams(filters).toString();
  const views = useMemo(() => pageViews(filters), [filters]);
  const bundle = useDowntimeBundle(useMemo(() => bundleQuery(filters), [filters]), env.timezone);
  const [drill, setDrill] = useState<{ key: string; selection: DrillSelection } | null>(null);
  const [closing, setClosing] = useState<ProductionEventView | null>(null);
  const selection = drill && drill.key === filterKey ? drill.selection : null;
  return (
    <Page width="wide">
      <div className="space-y-6" data-testid="downtime-analysis">
        <DowntimeHeader filters={filters} bundle={bundle} />
        <DowntimeFiltersBar filters={filters} onChange={change} />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-6">
            <KpiSummary bundle={bundle} />
            <ReliabilityCard filters={filters} />
          </div>
          <CurrentStopsPanel unitIds={filters.unitIds} onClose={setClosing} />
        </div>
        <ReasonPareto filters={filters} onChange={change} onEvents={(next) => setDrill({ key: filterKey, selection: next })} />
        {selection && <DrillEvents filters={filters} selection={selection} onDismiss={() => setDrill(null)} />}
        <TrendPanel filters={filters} bundle={bundle} views={views} />
        <div className="grid gap-6 lg:grid-cols-2">
          <BadActors bundle={bundle} views={views} />
          <CrewComparison bundle={bundle} views={views} />
        </div>
        <CalendarComparison filters={filters} bundle={bundle} />
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <StateTimeline filters={filters} />
        </Suspense>
        {closing && <CloseStopDialog event={closing} onClose={() => setClosing(null)} onDone={() => setClosing(null)} />}
      </div>
    </Page>
  );
}
