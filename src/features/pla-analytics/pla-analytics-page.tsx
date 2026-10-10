import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataState } from '@/features/ux-kit/data-state';
import { EventHubEnvProvider } from '@/features/event-hub/event-hub-env';
import { AnalyticsFilters } from './components/analytics-filters';
import { AnalyticsHeader } from './components/analytics-header';
import { useAnalyticsScope } from './hooks/use-analytics-scope';
import { PLA_TABS, type PlaTab } from './model/analytics-scope';
import { TAB_LABELS } from './model/display';
import { LossTreeTab } from './tabs/loss-tree-tab';
import { OeeTab } from './tabs/oee-tab';
import { OpportunitiesTab } from './tabs/opportunities-tab';
import { QualityTab } from './tabs/quality-tab';
import { ReconciliationTab } from './tabs/reconciliation-tab';
import { RepeatCausesTab } from './tabs/repeat-causes-tab';
import { TrendsTab } from './tabs/trends-tab';
import { WaterfallTab } from './tabs/waterfall-tab';

/**
 * PLA Analytics (plan 3.6, AN02 / AN03) behind the `v2.plaAnalytics` flag: one scope in the URL feeds every
 * tab, each tab one or more server snapshots (waterfall, loss tree, trends, reconciliation, quality,
 * repeat causes, opportunities, OEE); only the open tab fetches. Nothing is computed in the browser.
 */
export function PlaAnalyticsPage() {
  const tenantId = useV2TenantId();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant (tenant) to analyse its production losses." />;
  return (
    <EventHubEnvProvider tenantId={tenantId}>
      <PlaAnalyticsScreen />
    </EventHubEnvProvider>
  );
}

function PlaAnalyticsScreen() {
  const { scope, change } = useAnalyticsScope();
  return (
    <div className="space-y-4" data-testid="pla-analytics-v2">
      <AnalyticsHeader scope={scope} />
      <AnalyticsFilters scope={scope} onChange={change} />
      <Tabs value={scope.tab} onValueChange={(tab) => change({ tab: tab as PlaTab })}>
        <TabsList className="h-auto flex-wrap justify-start">
          {PLA_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab} data-testid={`tab-${tab}`}>
              {TAB_LABELS[tab]}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="waterfall">
          <WaterfallTab scope={scope} />
        </TabsContent>
        <TabsContent value="loss-tree">
          <LossTreeTab scope={scope} onChange={change} />
        </TabsContent>
        <TabsContent value="trends">
          <TrendsTab scope={scope} onChange={change} />
        </TabsContent>
        <TabsContent value="reconciliation">
          <ReconciliationTab scope={scope} />
        </TabsContent>
        <TabsContent value="quality">
          <QualityTab scope={scope} />
        </TabsContent>
        <TabsContent value="repeat-causes">
          <RepeatCausesTab scope={scope} />
        </TabsContent>
        <TabsContent value="opportunities">
          <OpportunitiesTab scope={scope} onChange={change} />
        </TabsContent>
        <TabsContent value="oee">
          <OeeTab scope={scope} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
