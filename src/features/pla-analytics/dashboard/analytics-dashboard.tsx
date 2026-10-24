import { Link } from 'react-router-dom';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { DataState } from '@/features/ux-kit/data-state';
import { Page, Section } from '@/features/ux-kit/page-layout';
import { EventHubEnvProvider } from '@/features/event-hub/event-hub-env';
import { useAuth } from '@/contexts/AuthContext';
import { usePlantSelection } from '@/contexts/PlantSelectionContext';
import { DashboardHeader } from './dashboard-header';
import { useDashboardScope } from './use-dashboard-scope';
import { DashboardDowntime, DashboardTopAssets } from './dashboard-downtime';
import { eventsHref } from './dashboard-links';
import { OeeSection } from './oee-section';
import { ForYouRow } from './for-you-row';
import { LatestEvents } from './latest-events';
import { RcaTiles } from './rca-tiles';
import { ReconciliationTiles } from './reconciliation-tiles';

/**
 * Dashboard (plan 3.6 step 3): a role-aware "For you" row first (UX audit §5.6), then every unit in the caller's scope over a rolling window — OEE with its policy
 * label (operational with its components, and the labelled reconciled tile, D04), downtime, the most
 * stopped assets, open and overdue reconciliations, RCA cases and actions, and the latest loss events. Every tile is a server
 * snapshot of the same scope and appears as soon as its own figures arrive. Every link carries the dashboard's
 * analysis context (B-8, `dashboard-links.ts`).
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

function DashboardScreen() {
  const { key, setKey, scope, node, orgOnly } = useDashboardScope();
  const { session } = useAuth();
  const { selection } = usePlantSelection();
  const plantName = selection?.tenant?.name ?? session?.tenant?.name ?? 'your plant';
  return (
    <Page width="wide">
      <div className="space-y-6" data-testid="analytics-dashboard">
        <DashboardHeader scope={scope} keyValue={key} onKey={setKey} orgOnly={orgOnly} plantName={plantName} />
        <ForYouRow scope={scope} />
        <OeeSection scope={scope} assetSelected={Boolean(node.assetId)} />
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
        <Section title="Latest loss events" actions={<Link className="text-sm underline" to={eventsHref(scope)}>All events</Link>}>
          <LatestEvents scope={scope} />
        </Section>
      </div>
    </Page>
  );
}
