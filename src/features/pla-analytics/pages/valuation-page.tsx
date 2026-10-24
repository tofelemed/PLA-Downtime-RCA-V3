import { useSearchParams } from 'react-router-dom';
import type { AnalyticsScope } from '../model/analytics-scope';
import { EconomicBreakdownCard } from '../reports/economic-breakdown-card';
import { LossValueCard } from '../reports/loss-value-card';

const VALUATION_INFO = 'Values use the approved policy, effective rates and FX captured by each period calculation. Missing policy, price or FX stays unvalued with its reason. The currency follows the choice in the page header.';

/** Loss valuation: the basis is the filter bar's "Valuation basis"; the ledger is its Ledger field, so titles do not repeat it. */
export function LossValuationPage({ scope }: { scope: AnalyticsScope }) {
  const [params] = useSearchParams();
  const chosen = params.get('valuation');
  const metric = chosen === 'standard_cost' || chosen === 'operational_cost' ? chosen : 'margin';
  return (
    <div className="space-y-4" data-testid="pla-valuation">
      {chosen === 'economic_impact' ? <EconomicBreakdownCard scope={scope} ledgerInTitle={false} /> : <LossValueCard scope={scope} metric={metric} ledgerInTitle={false} info={VALUATION_INFO} />}
    </div>
  );
}
