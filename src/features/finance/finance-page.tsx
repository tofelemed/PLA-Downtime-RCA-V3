import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { useUrlParam } from '@/features/codes-admin/hooks/use-url-param';
import { DataState } from '@/features/ux-kit/data-state';
import { pageNameOf } from '@/features/auth/navigation-items';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { FinanceAreaTabs } from './components/finance-area-tabs';
import { FinanceHeaderActions } from './finance-header-actions';
import { RecalculationNotice } from './components/recalculation-notice';
import { ValuationRatesLink } from './components/valuation-rates-link';
import { DemandStatusesTab } from './demand/demand-statuses-tab';
import { FxRatesTab } from './fx/fx-rates-tab';
import { PoliciesTab } from './policies/policies-tab';

const TABS = ['policies', 'fx', 'demand'] as const;
type FinanceTab = (typeof TABS)[number];

function FinanceScreen() {
  const [tab] = useUrlParam<FinanceTab>('tab', TABS, 'policies');
  return (
    <Page width="wide">
      <div className="space-y-6" data-testid="finance">
        <PageHeader
          title={pageNameOf('/finance')}
          titleAside={<RecalculationNotice />}
          actions={
            <>
              <ValuationRatesLink />
              <FinanceHeaderActions tab={tab} />
            </>
          }
        />
        <FinanceAreaTabs current={tab} />
        {tab === 'policies' && <PoliciesTab />}
        {tab === 'fx' && <FxRatesTab />}
        {tab === 'demand' && <DemandStatusesTab />}
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
