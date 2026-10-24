import { Navigate, useSearchParams } from 'react-router-dom';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { DataState } from '@/features/ux-kit/data-state';
import { Page } from '@/features/ux-kit/page-layout';
import { EventHubEnvProvider } from '@/features/event-hub/event-hub-env';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { useAnalyticsScope } from '../hooks/use-analytics-scope';
import { useProductionDayStart } from '../hooks/use-production-day-start';
import type { AnalyticsScope } from '../model/analytics-scope';
import { ReportChrome } from '../components/report-chrome';
import { viewOf } from './report-catalog';
import { ReportViewBody } from './report-view-body';
import { ReportViewPicker } from './report-view-picker';
import { ReportsFilters } from './reports-filters';
import { ReportsHeader } from './reports-header';

const MAX_UNITS = 100;

/**
 * Reports (plan 3.6 step 4): named units (always sent), periods by their plant dates, approved-only or
 * approved-else-draft revisions. One top bar picks the report type, then the report; the report is in the
 * URL (`?view=`, its type derived), so Back and shared links keep it.
 */
export function ReportsV2Page() {
  const tenantId = useV2TenantId();
  const [params] = useSearchParams();
  if (params.get('view') === 'activity') {
    const search = new URLSearchParams({ view: 'work-summary' });
    for (const key of ['from', 'to']) {
      const value = params.get(key);
      if (value) search.set(key, value);
    }
    return <Navigate to={{ pathname: '/audit', search: `?${search}` }} replace />;
  }
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to see its reports." />;
  return (
    <EventHubEnvProvider tenantId={tenantId}>
      <ReportsScreen />
    </EventHubEnvProvider>
  );
}

/** Waits for the units and the plant's production-day start: the default window is written to the URL once, in whole production days. */
function ReportsScreen() {
  const env = useEventHubEnv();
  const day = useProductionDayStart();
  if (env.unitsLoading || day.loading) return <DataState state="loading" />;
  return <ReportsBody dayStart={day.dayStart} />;
}

function ReportsBody({ dayStart }: { dayStart: string }) {
  const env = useEventHubEnv();
  // SME R12: management reports default to approved figures; provisional is an explicit choice.
  // DECISIONS 2026-10-19: a rolling window is whole production days (never the current clock time).
  const { scope, change } = useAnalyticsScope({ approvedByDefault: true, productionDays: { timeZone: env.timezone, dayStart } });
  const [params, setParams] = useSearchParams();
  const view = viewOf(params.get('view'));
  const chooseView = (next: string) =>
    setParams((current) => {
      const copy = new URLSearchParams(current);
      copy.set('view', next);
      return copy;
    });
  const allUnits = env.units.map((unit) => unit.id).sort();
  const named: AnalyticsScope = { ...scope, unitIds: scope.unitIds.length > 0 || allUnits.length > MAX_UNITS ? scope.unitIds : allUnits };
  return (
    <Page width="wide">
      <div className="space-y-4" data-testid="reports-v2">
        <ReportsHeader />
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3 print:hidden" role="group" aria-label="Report filters" data-testid="reports-top-bar">
          <ReportViewPicker view={view} onViewChange={chooseView} />
          <ReportsFilters scope={scope} dayStart={dayStart} onChange={change} />
        </div>
        <ReportChrome approvedOnly={scope.approvedOnly}>
          <ReportViewBody view={view} scope={named} dayStart={dayStart} />
        </ReportChrome>
      </div>
    </Page>
  );
}
