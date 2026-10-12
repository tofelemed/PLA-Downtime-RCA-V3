import { useQueryClient } from '@tanstack/react-query';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataState } from '@/features/ux-kit/data-state';
import { Page } from '@/features/ux-kit/page-layout';
import { EventHubEnvProvider } from '@/features/event-hub/event-hub-env';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { AnalyticsFilters } from './components/analytics-filters';
import { AnalyticsHeader } from './components/analytics-header';
import { useAnalyticsScope } from './hooks/use-analytics-scope';
import { PLA_TABS, type PlaTab } from './model/analytics-scope';
import { TAB_LABELS } from './model/display';
import { prefetchView } from './model/prefetch';
import { LossesTab } from './tabs/losses-tab';
import { OeeTab } from './tabs/oee-tab';
import { ReconciliationView } from './tabs/reconciliation-view';
import { TrendsTab } from './tabs/trends-tab';
import { WaterfallTab } from './tabs/waterfall-tab';

/**
 * Production loss analysis (plan 3.6, AN02 / AN03): one scope in the URL feeds every view — waterfall,
 * losses (loss tree, top opportunities, repeat causes, loss events), trends, reconciliation (with actuals
 * quality) and OEE — each a server snapshot; only the open view fetches, the others are prefetched when
 * their tab is hovered or focused. Nothing is computed in the browser.
 */
export function PlaAnalyticsPage() {
  const tenantId = useV2TenantId();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to analyse its production losses." />;
  return (
    <EventHubEnvProvider tenantId={tenantId}>
      <PlaAnalyticsScreen />
    </EventHubEnvProvider>
  );
}

function PlaAnalyticsScreen() {
  const { scope, change } = useAnalyticsScope();
  const env = useEventHubEnv();
  const client = useQueryClient();
  const prefetch = (tab: PlaTab) => prefetchView(client, { tenantId: env.tenantId, tab, scope, tz: env.timezone });
  return (
    <Page width="wide">
      <div className="space-y-4" data-testid="pla-analytics-v2">
        <AnalyticsHeader scope={scope} />
        <AnalyticsFilters scope={scope} onChange={change} />
        <Tabs value={scope.tab} onValueChange={(tab) => change({ tab: tab as PlaTab })}>
          <TabsList className="h-auto flex-wrap justify-start">
            {PLA_TABS.map((tab) => (
              <TabsTrigger key={tab} value={tab} data-testid={`tab-${tab}`} onPointerEnter={() => prefetch(tab)} onFocus={() => prefetch(tab)}>
                {TAB_LABELS[tab]}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="waterfall">
            <WaterfallTab scope={scope} />
          </TabsContent>
          <TabsContent value="losses">
            <LossesTab scope={scope} onChange={change} />
          </TabsContent>
          <TabsContent value="trends">
            <TrendsTab scope={scope} onChange={change} />
          </TabsContent>
          <TabsContent value="reconciliation">
            <ReconciliationView scope={scope} />
          </TabsContent>
          <TabsContent value="oee">
            <OeeTab scope={scope} />
          </TabsContent>
        </Tabs>
      </div>
    </Page>
  );
}
