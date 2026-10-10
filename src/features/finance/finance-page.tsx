import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataState } from '@/features/ux-kit/data-state';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { RecalculationNotice } from './components/recalculation-notice';
import { FxRatesTab } from './fx/fx-rates-tab';
import { PoliciesTab } from './policies/policies-tab';

/**
 * Finance administration (plan 2.6 screens, prerequisite of 3.10) at `/finance` behind `v2.codesAdmin`:
 * valuation policy versions with the finance approval (VAL01, D08) and the approved, dated FX rate
 * table (IRR / USD). Every rule — roles, tenant-wide grant, separation of duties, overlaps — is the
 * server's; refusals are shown as it states them.
 */
export function FinancePage() {
  const tenantId = useV2TenantId();
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant (tenant) to manage its valuation policy and FX rates." />;
  return <FinanceScreen />;
}

function FinanceScreen() {
  const { timezone, source } = usePlantTimezone();
  return (
    <div className="space-y-4" data-testid="finance">
      <header>
        <h1 className="text-2xl font-bold">Finance — valuation</h1>
        <p className="text-sm text-muted-foreground">
          Valuation policy and FX rates of this plant (tenant-wide settings). Times in {timezone}
          {source === 'utc-fallback' ? ' (no plant timezone configured)' : ''}.
        </p>
      </header>
      <RecalculationNotice />
      <Tabs defaultValue="policies">
        <TabsList>
          <TabsTrigger value="policies" data-testid="tab-policies">
            Valuation policy
          </TabsTrigger>
          <TabsTrigger value="fx-rates" data-testid="tab-fx-rates">
            FX rates
          </TabsTrigger>
        </TabsList>
        <TabsContent value="policies">
          <PoliciesTab timezone={timezone} />
        </TabsContent>
        <TabsContent value="fx-rates">
          <FxRatesTab timezone={timezone} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
