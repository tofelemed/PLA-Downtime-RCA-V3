import { lazy, Suspense, useId } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useOeeReport } from '@/api/v2/queries/reports';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataState } from '@/features/ux-kit/data-state';
import { DisabledReason } from '@/features/ux-kit/disabled-reason';
import { Page } from '@/features/ux-kit/page-layout';
import { EventHubEnvProvider } from '@/features/event-hub/event-hub-env';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { ScopeExport } from '../components/scope-export';
import { useAnalyticsScope } from '../hooks/use-analytics-scope';
import { useProductionDayStart } from '../hooks/use-production-day-start';
import { exportBlockedReason, exportRequestOf, oeeQuery, type AnalyticsScope } from '../model/analytics-scope';
import { revisionSelectionLabel } from '../model/links';
import { ReconciliationTab } from '../tabs/reconciliation-tab';
import { EconomicBreakdownCard } from './economic-breakdown-card';
import { LossValueCard } from './loss-value-card';
import { DowntimeReasonCard, OeeByDay } from './production-report';
import { ReportsFilters } from './reports-filters';
import { ReportsHeader } from './reports-header';

const DailyReport = lazy(() => import('@/features/ops-reports/daily/daily-report').then((m) => ({ default: m.DailyReport })));

const MAX_UNITS = 100;
const VIEWS = [
  { key: 'production', label: 'OEE and downtime' },
  { key: 'daily', label: 'Daily production' },
  { key: 'reconciliation', label: 'Reconciliation' },
  { key: 'value', label: 'Loss value' },
  { key: 'exports', label: 'Exports' },
] as const;
type ReportView = (typeof VIEWS)[number]['key'];
const viewOf = (value: string | null): ReportView => VIEWS.find((view) => view.key === value)?.key ?? 'production';

/**
 * Reports (plan 3.6 step 4): named units (always sent), periods by their plant dates, approved-only or
 * approved-else-draft revisions; views for OEE and downtime, reconciliation, loss value,
 * and asynchronous CSV / PDF exports of approved content. The view is in the
 * URL (`?view=`), so Back and shared links keep it.
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
        <ReportsHeader scope={named} shownUnitIds={scope.unitIds} />
        <ReportsFilters scope={scope} dayStart={dayStart} onChange={change} />
        <Tabs value={view} onValueChange={chooseView}>
          <TabsList className="h-auto flex-wrap justify-start">
            {VIEWS.map((entry) => (
              <TabsTrigger key={entry.key} value={entry.key} data-testid={`report-tab-${entry.key}`}>
                {entry.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="production" className="space-y-4">
            <OeeByDay scope={named} />
            <DowntimeReasonCard scope={named} />
          </TabsContent>
          <TabsContent value="daily">
            <Suspense fallback={<DataState state="loading" />}>
              <DailyReport scope={named} dayStart={dayStart} />
            </Suspense>
          </TabsContent>
          <TabsContent value="reconciliation">
            <ReconciliationTab scope={named} />
          </TabsContent>
          <TabsContent value="value" className="space-y-4">
            <LossValueCard scope={named} />
            <EconomicBreakdownCard scope={named} />
          </TabsContent>
          <TabsContent value="exports">
            <Exports scope={named} />
          </TabsContent>
        </Tabs>
      </div>
    </Page>
  );
}

const EXPORTS = [
  { reportType: 'period_summary', label: 'Period summary', testId: 'export-period-summary' },
  { reportType: 'loss_lines', label: 'Loss lines', testId: 'export-loss-lines' },
] as const;

function Exports({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useOeeReport(oeeQuery(scope, 'day', 'operational'), env.timezone);
  const provisional = query.data?.isProvisional ?? true;
  const reason = exportBlockedReason(scope, provisional, revisionSelectionLabel(true));
  const reasonId = useId();
  return (
    <div className="space-y-3" data-testid="report-exports">
      <DisabledReason id={reasonId} reason={reason} />
      <p className="text-sm text-muted-foreground">
        Exports contain approved revisions only (the latest approved revision of every period of these units and dates), prepared in the background. CSV: every row names its
        period, revision and approval. PDF: a printable report in the plant calendar, with money in your display currency.
      </p>
      {EXPORTS.map((entry) => (
        <div key={entry.reportType} className="flex flex-wrap gap-4">
          {(['csv', 'pdf'] as const).map((format) => (
            <ScopeExport
              key={format}
              request={exportRequestOf(scope, entry.reportType, provisional)}
              disabledReason={reason}
              reasonShownAt={reasonId}
              label={entry.label}
              format={format}
              timezone={env.timezone}
              testId={format === 'csv' ? entry.testId : `${entry.testId}-pdf`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
