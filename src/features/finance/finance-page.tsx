import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePlantDates } from '@/features/codes-admin/hooks/use-plant-dates';
import { useUrlParam } from '@/features/codes-admin/hooks/use-url-param';
import { DataState } from '@/features/ux-kit/data-state';
import { pageNameOf } from '@/features/auth/navigation-items';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { RecalculationNotice } from './components/recalculation-notice';
import { ValuationRatesLink } from './components/valuation-rates-link';
import { DemandStatusesTab } from './demand/demand-statuses-tab';
import { FxRatesTab } from './fx/fx-rates-tab';
import { PoliciesTab } from './policies/policies-tab';

const TABS = ['policies', 'fx', 'demand'] as const;
type FinanceTab = (typeof TABS)[number];

function FinanceScreen() {
  const { timezone, utcFallback } = usePlantDates();
  const [tab, setTab] = useUrlParam<FinanceTab>('tab', TABS, 'policies');
  return (
    <Page width="wide">
      <div className="space-y-6" data-testid="finance">
        <PageHeader
          title={pageNameOf('/finance')}
          description={`Valuation policy, exchange rates and product demand of this plant. Times in ${timezone}${utcFallback ? ' (no plant timezone set)' : ''}.`}
        />
        <ValuationRatesLink />
        <RecalculationNotice />
        <Tabs value={tab} onValueChange={(value) => setTab(value as FinanceTab)}>
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="policies" data-testid="tab-policies">
              Valuation policy
            </TabsTrigger>
            <TabsTrigger value="fx" data-testid="tab-fx-rates">
              Exchange rates
            </TabsTrigger>
            <TabsTrigger value="demand" data-testid="tab-demand">
              Demand
            </TabsTrigger>
          </TabsList>
          <TabsContent value="policies" className="pt-4">
            <PoliciesTab />
          </TabsContent>
          <TabsContent value="fx" className="pt-4">
            <FxRatesTab />
          </TabsContent>
          <TabsContent value="demand" className="pt-4">
            <DemandStatusesTab />
          </TabsContent>
        </Tabs>
      </div>
    </Page>
  );
}

/**
 * Finance administration (plan 2.6) at `/finance`: valuation policy versions with the finance approval
 * and the approved, dated exchange rate table (IRR / USD). Every rule — roles, tenant-wide grant,
 * separation of duties, overlaps — is the server's; refusals are shown in plain language.
 */
export function FinancePage() {
  const tenantId = useV2TenantId();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to manage its valuation policy and exchange rates." />;
  return <FinanceScreen />;
}
