import { lazy, Suspense, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Skeleton } from '@/components/ui/skeleton';
import { AnalysisPageNav } from '@/features/analysis-navigation/analysis-page-nav';
import { DOWNTIME_PAGES, type DowntimeView } from '@/features/analysis-navigation/analysis-pages';
import { CloseStopDialog } from '@/features/event-hub/components/close-stop-dialog';
import { CodeEventDialog } from '@/features/event-hub/components/code-event-dialog';
import { EventHubFrame } from '@/features/event-hub/event-hub-frame';
import { useWindowRangeText } from '@/features/event-hub/hooks/use-window-range-text';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { unitsLabel } from '@/features/pla-analytics/model/links';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { DowntimeFiltersBar } from './components/downtime-filters-bar';
import { DowntimeHeader } from './components/downtime-header';
import { useDowntimeBundle } from './hooks/use-downtime-bundle';
import { useDowntimeFilters } from './hooks/use-downtime-filters';
import { DOWNTIME_SCOPE_NOTES, downtimePageSettings } from './model/page-settings';
import { pageBundleQuery } from './model/bundle-views';

const PAGES = {
  overview: lazy(() => import('./pages/overview-page').then((module) => ({ default: module.DowntimeOverviewPage }))),
  stops: lazy(() => import('./pages/stops-page').then((module) => ({ default: module.DowntimeStopsPage }))),
  causes: lazy(() => import('./pages/causes-page').then((module) => ({ default: module.DowntimeCausesPage }))),
  trends: lazy(() => import('./pages/trends-page').then((module) => ({ default: module.DowntimeTrendsPage }))),
  reliability: lazy(() => import('./pages/reliability-page').then((module) => ({ default: module.DowntimeReliabilityPage }))),
};

export function DowntimeAnalysisPage() {
  const { pathname } = useLocation();
  const view = DOWNTIME_PAGES.find((page) => page.path === pathname)?.key ?? 'overview';
  return <EventHubFrame noTenantText="Choose a plant to analyse its downtime."><DowntimeScreen view={view} /></EventHubFrame>;
}

function DowntimeScreen({ view }: { view: DowntimeView }) {
  const env = useEventHubEnv();
  const { filters, change } = useDowntimeFilters();
  const [params] = useSearchParams();
  const [closing, setClosing] = useState<ProductionEventView | null>(null);
  const [coding, setCoding] = useState<ProductionEventView | null>(null);
  const { mode, bundled, scope, page, showTrend } = downtimePageSettings(view, params);
  const bundle = useDowntimeBundle(pageBundleQuery(filters, view, mode), env.timezone, bundled);
  const Content = PAGES[view];
  const windowText = useWindowRangeText()({ label: filters.windowLabel, from: filters.from, to: filters.to, relative: filters.relativeWindow !== null });
  return (
    <Page width="wide">
      <div className="space-y-5" data-testid="downtime-analysis">
        {bundled ? <DowntimeHeader filters={filters} bundle={bundle} title={`Downtime analysis · ${page.label}`} description={page.description} />
          : <PageHeader title={`Downtime analysis · ${page.label}`} description={page.description} meta={<p className="text-xs text-muted-foreground">{unitsLabel(filters.unitIds, env.unitName)} · {windowText} · {env.timezone}</p>} />}
        <AnalysisPageNav label="Downtime analysis pages" pages={DOWNTIME_PAGES} />
        <DowntimeFiltersBar filters={filters} onChange={change} scope={scope} showTrend={showTrend} showSchedule={params.get('presentation') !== 'timeline' || view !== 'stops'} />
        <p className="text-xs text-muted-foreground" data-testid="period-selection-note">{DOWNTIME_SCOPE_NOTES[scope]}</p>
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <Content filters={filters} bundle={bundle} onChange={change} onClose={setClosing} onCode={setCoding} />
        </Suspense>
        {closing && <CloseStopDialog event={closing} onClose={() => setClosing(null)} onDone={() => setClosing(null)} />}
        {coding && <CodeEventDialog event={coding} onClose={() => setCoding(null)} onDone={() => setCoding(null)} />}
      </div>
    </Page>
  );
}
