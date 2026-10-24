import { lazy, Suspense, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Skeleton } from '@/components/ui/skeleton';
import { AnalysisModeSelect } from '@/features/analysis-navigation/analysis-mode-select';
import { AnalysisPageNav } from '@/features/analysis-navigation/analysis-page-nav';
import { DOWNTIME_PAGES, type DowntimeView } from '@/features/analysis-navigation/analysis-pages';
import { CloseStopDialog } from '@/features/event-hub/components/close-stop-dialog';
import { CodeEventDialog } from '@/features/event-hub/components/code-event-dialog';
import { EventHubFrame } from '@/features/event-hub/event-hub-frame';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { Page } from '@/features/ux-kit/page-layout';
import { DowntimeFiltersBar } from './components/downtime-filters-bar';
import { DowntimeHeader } from './components/downtime-header';
import { useDowntimeBundle } from './hooks/use-downtime-bundle';
import { useDowntimeFilters } from './hooks/use-downtime-filters';
import { downtimePageSettings } from './model/page-settings';
import { DOWNTIME_MODES } from './model/page-modes';
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

function ModeSelect({ view }: { view: DowntimeView }) {
  const spec = DOWNTIME_MODES[view];
  return spec ? <AnalysisModeSelect param={spec.param} label={spec.label} options={spec.options} stacked /> : null;
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
  const showSchedule = params.get('presentation') !== 'timeline' || view !== 'stops';
  return (
    <Page width="wide">
      <div className="space-y-5" data-testid="downtime-analysis">
        <DowntimeHeader filters={filters} bundle={bundled ? bundle : null} title={`Downtime analysis · ${page.label}`} />
        <AnalysisPageNav label="Downtime analysis pages" pages={DOWNTIME_PAGES} />
        <DowntimeFiltersBar filters={filters} onChange={change} scope={scope} showTrend={showTrend} showSchedule={showSchedule} mode={<ModeSelect view={view} />} />
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <Content filters={filters} bundle={bundle} onChange={change} onClose={setClosing} onCode={setCoding} />
        </Suspense>
        {closing && <CloseStopDialog event={closing} onClose={() => setClosing(null)} onDone={() => setClosing(null)} />}
        {coding && <CodeEventDialog event={coding} onClose={() => setCoding(null)} onDone={() => setCoding(null)} />}
      </div>
    </Page>
  );
}
