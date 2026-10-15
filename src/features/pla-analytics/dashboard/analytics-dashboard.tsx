import { Link, useSearchParams } from 'react-router-dom';
import { useOeeReport } from '@/api/v2/queries/reports';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { Label } from '@/components/ui/label';
import { DataState } from '@/features/ux-kit/data-state';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { EventHubEnvProvider } from '@/features/event-hub/event-hub-env';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { SELECT_CLASS } from '../components/analytics-filters';
import { SnapshotStatus } from '../components/snapshot-status';
import { oeeQuery, type AnalyticsScope } from '../model/analytics-scope';
import { DASHBOARD_PRESETS, dashboardScope, presetKeyOf } from '../model/dashboard-scope';
import { DashboardDowntime, DashboardTopAssets } from './dashboard-downtime';
import { DashboardOee } from './dashboard-oee';
import { LatestEvents } from './latest-events';
import { RcaTiles } from './rca-tiles';
import { ReconciliationTiles } from './reconciliation-tiles';

/**
 * Dashboard (plan 3.6 step 3): every unit in the caller's scope over a rolling window — OEE with its policy
 * label (operational with its components, and the labelled reconciled tile, D04), downtime, the most
 * stopped assets, open and overdue reconciliations, RCA cases and actions, and the latest loss events. Every tile is a server
 * snapshot of the same scope and appears as soon as its own figures arrive.
 */
export function AnalyticsDashboard() {
  const tenantId = useV2TenantId();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to see its dashboard." />;
  return (
    <EventHubEnvProvider tenantId={tenantId}>
      <DashboardScreen />
    </EventHubEnvProvider>
  );
}

function WindowSelect({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="dashboard-window">Window</Label>
      <select id="dashboard-window" data-testid="dashboard-window" className={SELECT_CLASS} value={value} onChange={(e) => onChange(e.target.value)}>
        {DASHBOARD_PRESETS.map((preset) => (
          <option key={preset.key} value={preset.key}>
            {preset.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function DashboardStatus({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const lead = useOeeReport(oeeQuery(scope, 'unit', 'operational'), env.timezone);
  return (
    <SnapshotStatus
      scopeLabel={`All units in your scope · ${scope.windowLabel}`}
      timezone={env.timezone}
      timezoneIsFallback={env.timezoneIsFallback}
      response={lead.data}
      isError={lead.isError}
      testId="dashboard-snapshot"
    />
  );
}

function DashboardScreen() {
  const [params, setParams] = useSearchParams();
  const key = presetKeyOf(params.get('window'));
  const scope = dashboardScope(key);
  const choose = (next: string) => setParams(next === '7d' ? {} : { window: next }, { replace: true });
  return (
    <Page width="wide">
      <div className="space-y-6" data-testid="analytics-dashboard">
        <PageHeader title="Dashboard" description="Key figures of the selected plant." actions={<WindowSelect value={key} onChange={choose} />} meta={<DashboardStatus scope={scope} />} />
        <Section title="OEE">
          <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
            <DashboardOee scope={scope} policy="operational" />
            <DashboardOee scope={scope} policy="reconciled" />
          </div>
        </Section>
        <Section title="Downtime">
          <div className="grid gap-4 xl:grid-cols-2">
            <DashboardDowntime scope={scope} />
            <DashboardTopAssets scope={scope} />
          </div>
        </Section>
        <Section title="Reconciliation">
          <ReconciliationTiles scope={scope} />
        </Section>
        <Section title="Root cause analysis">
          <RcaTiles />
        </Section>
        <Section title="Latest loss events" actions={<Link className="text-sm underline" to="/events">All events</Link>}>
          <LatestEvents scope={scope} />
        </Section>
      </div>
    </Page>
  );
}
