import { lazy, Suspense } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { Skeleton } from '@/components/ui/skeleton';
import { AnalysisSnapshotContext } from '@/features/analysis-navigation/analysis-snapshot-context';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { unitsLabel } from './model/links';
import { AnalysisPageNav } from '@/features/analysis-navigation/analysis-page-nav';
import { legacyPlaPath, PLA_PAGES, type PlaView } from '@/features/analysis-navigation/analysis-pages';
import { DataState } from '@/features/ux-kit/data-state';
import { Page } from '@/features/ux-kit/page-layout';
import { EventHubEnvProvider } from '@/features/event-hub/event-hub-env';
import { AnalyticsFilters } from './components/analytics-filters';
import { AnalyticsHeader } from './components/analytics-header';
import { useAnalyticsScope } from './hooks/use-analytics-scope';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { plaPagesFor } from './model/money-access';
import { ReportChrome } from './components/report-chrome';
import { ViewPicker } from './components/view-picker';

const PAGES = {
  overview: lazy(() => import('./tabs/waterfall-tab').then((module) => ({ default: module.WaterfallTab }))),
  losses: lazy(() => import('./tabs/losses-tab').then((module) => ({ default: module.LossesTab }))),
  trends: lazy(() => import('./tabs/trends-tab').then((module) => ({ default: module.TrendsTab }))),
  reconciliation: lazy(() => import('./tabs/reconciliation-view').then((module) => ({ default: module.ReconciliationView }))),
  oee: lazy(() => import('./tabs/oee-tab').then((module) => ({ default: module.OeeTab }))),
  valuation: lazy(() => import('./pages/valuation-page').then((module) => ({ default: module.LossValuationPage }))),
  capacity: lazy(() => import('./capacity-gap/capacity-gap-page').then((module) => ({ default: module.CapacityGapPage }))),
};

export function PlaAnalyticsPage() {
  const tenantId = useV2TenantId();
  const location = useLocation();
  const view = PLA_PAGES.find((page) => page.path === location.pathname)?.key ?? 'overview';
  const [params] = useSearchParams();
  const tab = params.get('tab');
  const anchor = location.hash.slice(1);
  const legacy = view === 'overview' ? legacyPlaPath(tab ?? ({ opportunities: 'losses', 'repeat-causes': 'losses', 'loss-events': 'losses', quality: 'reconciliation' } as Record<string, string>)[anchor] ?? null) : null;
  if (legacy) {
    const next = new URLSearchParams(params);
    next.delete('tab');
    const detail = ['opportunities', 'repeat-causes', 'loss-events'].includes(anchor) ? anchor : tab;
    if (detail && ['opportunities', 'repeat-causes', 'loss-events'].includes(detail)) next.set('breakdown', detail);
    if (anchor === 'quality' || tab === 'quality') next.set('inspection', 'quality');
    return <Navigate to={{ pathname: legacy, search: `?${next}` }} replace />;
  }
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to analyse its production losses." />;
  return <EventHubEnvProvider tenantId={tenantId}><PlaAnalyticsScreen view={view} /></EventHubEnvProvider>;
}

/** The PLA pages share the Reports look (`ReportChrome`): report cards and tables, one "Provisional" marker where drafts can show. */
function PlaAnalyticsScreen({ view }: { view: PlaView }) {
  const { scope, change } = useAnalyticsScope();
  const [params] = useSearchParams();
  const breakdown = params.get('breakdown');
  const lossRecords = view === 'losses' && breakdown === 'loss-events';
  const quantifiedLosses = view === 'losses' && breakdown !== 'loss-events' && breakdown !== 'repeat-causes';
  const env = useEventHubEnv();
  const { canViewMoney } = useCapabilities();
  const page = PLA_PAGES.find((entry) => entry.key === view) ?? PLA_PAGES[0];
  const Content = PAGES[view];
  return (
    <Page width="wide">
      <div className="space-y-5" data-testid="pla-analytics-v2" data-view={view}>
        <AnalyticsHeader scope={scope} title={`Production loss analysis · ${page.label}`} overview={view === 'overview'} />
        <AnalysisPageNav label="Production loss analysis pages" pages={plaPagesFor(PLA_PAGES, canViewMoney)} />
        {/* capacity gap: no window or ledger, it has its own unit / product / as-of filters */}
        {view !== 'capacity' && <AnalyticsFilters scope={scope} onChange={change} picker={<ViewPicker view={view} scope={scope} onChange={change} />} showLedger={view === 'overview' || quantifiedLosses || view === 'valuation'} showApproved={!lossRecords} />}
        <AnalysisSnapshotContext.Provider value={view === 'overview' ? null : { scopeLabel: `${unitsLabel(scope.unitIds, env.unitName)} · ${scope.windowLabel}`, timezone: env.timezone, timezoneIsFallback: env.timezoneIsFallback }}>
          <ReportChrome approvedOnly={scope.approvedOnly} ownEmpty>
            <Suspense fallback={<Skeleton className="h-64 w-full" />}><Content scope={scope} onChange={change} /></Suspense>
          </ReportChrome>
        </AnalysisSnapshotContext.Provider>
      </div>
    </Page>
  );
}
