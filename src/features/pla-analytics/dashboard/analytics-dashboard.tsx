import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { useDowntimeReport, useOeeReport } from '@/api/v2/queries/reports';
import { Button } from '@/components/ui/button';
import { DataState } from '@/features/ux-kit/data-state';
import { EventHubEnvProvider } from '@/features/event-hub/event-hub-env';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { ReportCard } from '@/features/downtime-analysis/components/report-card';
import { KpiTile } from '@/features/downtime-analysis/components/kpi-summary';
import { findMetric, SUMMARY_TILES } from '@/features/downtime-analysis/model/kpi-display';
import { ScopeHeader } from '@/features/ux-kit/scope-header';
import { oeeQuery, parseScope, repeatQuery, type AnalyticsScope } from '../model/analytics-scope';
import { findKpi } from '../model/display';
import { OeeTile } from '../components/oee-tile';
import { ReconciliationTiles } from './reconciliation-tiles';

const LINKS = [
  { to: '/pla-analytics', label: 'PLA Analytics' },
  { to: '/reports', label: 'Reports' },
  { to: '/downtime', label: 'Downtime Analysis' },
  { to: '/events', label: 'Event Hub' },
];

/**
 * Dashboard on v2 (plan 3.6 step 3) while `v2.plaAnalytics` is on: the last 7 days of every unit in scope —
 * OEE with its policy label (operational and the labelled reconciled tile, D04), downtime, open and overdue
 * reconciliations — all server snapshots. The v1 dashboard (heuristic OEE) stays for flag-off plants (C4).
 */
export function AnalyticsDashboard() {
  const tenantId = useV2TenantId();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant (tenant) to see its dashboard." />;
  return (
    <EventHubEnvProvider tenantId={tenantId}>
      <DashboardScreen />
    </EventHubEnvProvider>
  );
}

function DashboardScreen() {
  const env = useEventHubEnv();
  const [scope] = useState<AnalyticsScope>(() => parseScope(new URLSearchParams(), Date.now()));
  return (
    <div className="space-y-4" data-testid="analytics-dashboard">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <ScopeHeader scopeLabel={`All units in your scope · ${scope.windowLabel}`} timezone={env.timezone} timezoneIsFallback={env.timezoneIsFallback} />
        <nav className="flex flex-wrap gap-2" aria-label="Analytics screens">
          {LINKS.map((link) => (
            <Button key={link.to} asChild size="sm" variant="outline">
              <Link to={link.to}>{link.label}</Link>
            </Button>
          ))}
        </nav>
      </header>
      <div className="grid gap-4 xl:grid-cols-2">
        <OeeCard scope={scope} policy="operational" />
        <OeeCard scope={scope} policy="reconciled" />
      </div>
      <DowntimeCard scope={scope} />
      <ReconciliationTiles scope={scope} />
    </div>
  );
}

function OeeCard({ scope, policy }: { scope: AnalyticsScope; policy: 'operational' | 'reconciled' }) {
  const env = useEventHubEnv();
  const query = useOeeReport(oeeQuery(scope, 'unit', policy), env.timezone);
  const data = query.data?.data;
  const prefix = policy === 'reconciled' ? 'reconciled_' : '';
  const label = data?.label ?? (policy === 'operational' ? 'Operational OEE (ISO 22400)' : 'Reconciled PLA OEE');
  return (
    <ReportCard title={label} testId={`dashboard-oee-${policy}`} query={query} response={query.data}>
      <OeeTile
        title="OEE"
        label={label}
        view={findKpi(data?.total, `${prefix}oee`)}
        denominator={policy === 'operational' ? 'over scheduled time' : 'capacity-ledger good ÷ capacity'}
        testId={`dashboard-oee-${policy}-tile`}
      />
    </ReportCard>
  );
}

function DowntimeCard({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useDowntimeReport(repeatQuery(scope, 'reason'), env.timezone);
  const summary = query.data?.data.summary;
  const tiles = SUMMARY_TILES.filter((tile) => ['downtime_total', 'downtime_unplanned', 'stop_count', 'scheduled_availability'].includes(tile.metric));
  return (
    <ReportCard title="Downtime" testId="dashboard-downtime" query={query} response={query.data}>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <KpiTile key={tile.metric} spec={tile} view={findMetric(summary, tile.metric)} />
        ))}
      </dl>
    </ReportCard>
  );
}
