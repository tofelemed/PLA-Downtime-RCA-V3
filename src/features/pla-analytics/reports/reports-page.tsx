import { useSearchParams } from 'react-router-dom';
import { useOeeReport } from '@/api/v2/queries/reports';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataState } from '@/features/ux-kit/data-state';
import { Page } from '@/features/ux-kit/page-layout';
import { EventHubEnvProvider } from '@/features/event-hub/event-hub-env';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { ScopeExport } from '../components/scope-export';
import { useAnalyticsScope } from '../hooks/use-analytics-scope';
import { exportRequestOf, oeeQuery, type AnalyticsScope } from '../model/analytics-scope';
import { ReconciliationTab } from '../tabs/reconciliation-tab';
import { EconomicBreakdownCard } from './economic-breakdown-card';
import { LossValueCard } from './loss-value-card';
import { DowntimeReasonCard, OeeByDay } from './production-report';
import { ReportsFilters } from './reports-filters';
import { ReportsHeader } from './reports-header';
import { WorkSummary } from './work-summary';

const MAX_UNITS = 100;
const VIEWS = [
  { key: 'production', label: 'OEE and downtime' },
  { key: 'reconciliation', label: 'Reconciliation' },
  { key: 'value', label: 'Loss value' },
  { key: 'activity', label: 'Work summary' },
  { key: 'exports', label: 'Exports' },
] as const;
type ReportView = (typeof VIEWS)[number]['key'];
const viewOf = (value: string | null): ReportView => VIEWS.find((view) => view.key === value)?.key ?? 'production';

/**
 * Reports (plan 3.6 step 4): named units (always sent), periods by their plant dates, approved-only or
 * approved-else-draft revisions; views for OEE and downtime, reconciliation, loss value, the work summary
 * (RCA cases, tasks, audit activity) and asynchronous CSV / PDF exports of approved content. The view is in the
 * URL (`?view=`), so Back and shared links keep it.
 */
export function ReportsV2Page() {
  const tenantId = useV2TenantId();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to see its reports." />;
  return (
    <EventHubEnvProvider tenantId={tenantId}>
      <ReportsScreen />
    </EventHubEnvProvider>
  );
}

function ReportsScreen() {
  const env = useEventHubEnv();
  // SME R12: management reports default to approved figures; provisional is an explicit choice
  const { scope, change } = useAnalyticsScope({ approvedByDefault: true });
  const [params, setParams] = useSearchParams();
  const view = viewOf(params.get('view'));
  const chooseView = (next: string) =>
    setParams((current) => {
      const copy = new URLSearchParams(current);
      copy.set('view', next);
      return copy;
    });
  if (env.unitsLoading) return <DataState state="loading" />;
  const allUnits = env.units.map((unit) => unit.id).sort();
  const named: AnalyticsScope = { ...scope, unitIds: scope.unitIds.length > 0 || allUnits.length > MAX_UNITS ? scope.unitIds : allUnits };
  return (
    <Page width="wide">
      <div className="space-y-4" data-testid="reports-v2">
        <ReportsHeader scope={named} shownUnitIds={scope.unitIds} />
        <ReportsFilters scope={scope} onChange={change} />
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
          <TabsContent value="reconciliation">
            <ReconciliationTab scope={named} />
          </TabsContent>
          <TabsContent value="value" className="space-y-4">
            <LossValueCard scope={named} />
            <EconomicBreakdownCard scope={named} />
          </TabsContent>
          <TabsContent value="activity">
            <WorkSummary scope={named} />
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
  return (
    <div className="space-y-3" data-testid="report-exports">
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
