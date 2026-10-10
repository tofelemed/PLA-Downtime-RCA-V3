import { useState } from 'react';
import { useOeeReport } from '@/api/v2/queries/reports';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataState } from '@/features/ux-kit/data-state';
import { EventHubEnvProvider } from '@/features/event-hub/event-hub-env';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { ReportCard } from '@/features/downtime-analysis/components/report-card';
import { useAnalyticsScope } from '../hooks/use-analytics-scope';
import { exportRequestOf, oeeQuery, type AnalyticsScope } from '../model/analytics-scope';
import { ScopeExport } from '../components/scope-export';
import { OeeGroupTable } from '../components/oee-group-table';
import { ReconciliationTab } from '../tabs/reconciliation-tab';
import { DowntimeReasonCard } from './downtime-reason-card';
import { LossValueCard } from './loss-value-card';
import { ReportsFilters } from './reports-filters';
import { ReportsHeader } from './reports-header';

const MAX_UNITS = 100;

/**
 * Reports on v2 (plan 3.6 step 4) while `v2.plaAnalytics` is on: named units (always sent), periods by
 * their plant dates, approved-only or approved-else-draft revisions, tabs for OEE, downtime, reconciliation
 * and loss value, and asynchronous CSV exports of approved content. The header names the generated time,
 * the approval status and the calculation runs of the snapshot.
 */
export function ReportsV2Page() {
  const tenantId = useV2TenantId();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant (tenant) to see its reports." />;
  return (
    <EventHubEnvProvider tenantId={tenantId}>
      <ReportsScreen />
    </EventHubEnvProvider>
  );
}

function ReportsScreen() {
  const env = useEventHubEnv();
  const { scope, change } = useAnalyticsScope();
  const [tab, setTab] = useState('oee');
  if (env.unitsLoading) return <DataState state="loading" />;
  const allUnits = env.units.map((unit) => unit.id).sort();
  const named: AnalyticsScope = { ...scope, unitIds: scope.unitIds.length > 0 || allUnits.length > MAX_UNITS ? scope.unitIds : allUnits };
  return (
    <div className="space-y-4" data-testid="reports-v2">
      <ReportsHeader scope={named} />
      <ReportsFilters scope={scope} onChange={change} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="oee" data-testid="report-tab-oee">OEE by day</TabsTrigger>
          <TabsTrigger value="downtime" data-testid="report-tab-downtime">Downtime</TabsTrigger>
          <TabsTrigger value="reconciliation" data-testid="report-tab-reconciliation">Reconciliation</TabsTrigger>
          <TabsTrigger value="value" data-testid="report-tab-value">Loss value</TabsTrigger>
          <TabsTrigger value="exports" data-testid="report-tab-exports">Exports</TabsTrigger>
        </TabsList>
        <TabsContent value="oee">
          <OeeByDay scope={named} />
        </TabsContent>
        <TabsContent value="downtime">
          <DowntimeReasonCard scope={named} />
        </TabsContent>
        <TabsContent value="reconciliation">
          <ReconciliationTab scope={named} />
        </TabsContent>
        <TabsContent value="value">
          <LossValueCard scope={named} />
        </TabsContent>
        <TabsContent value="exports">
          <Exports scope={named} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OeeByDay({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useOeeReport(oeeQuery(scope, 'day', 'operational'), env.timezone);
  const data = query.data?.data;
  return (
    <ReportCard title={`${data?.label ?? 'OEE'} by plant date`} testId="report-oee" query={query} response={query.data} isEmpty={data?.groups.length === 0} emptyText="No periods start on these dates.">
      {data && <OeeGroupTable report={data} groupTitle="Plant date" labelOf={(key) => key ?? '—'} testId="report-oee-days" />}
    </ReportCard>
  );
}

function Exports({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useOeeReport(oeeQuery(scope, 'day', 'operational'), env.timezone);
  const provisional = query.data?.isProvisional ?? true;
  return (
    <div className="space-y-3" data-testid="report-exports">
      <p className="text-sm text-muted-foreground">
        Exports contain approved revisions only (latest approved revision of every period of these units and dates), rendered as CSV by a background job;
        every row names its period, revision, approval snapshot and calculation run. PDF is not available yet.
      </p>
      <ScopeExport request={exportRequestOf(scope, 'period_summary', provisional)} label="Period summary" timezone={env.timezone} testId="export-period-summary" />
      <ScopeExport request={exportRequestOf(scope, 'loss_lines', provisional)} label="Loss lines" timezone={env.timezone} testId="export-loss-lines" />
    </div>
  );
}
