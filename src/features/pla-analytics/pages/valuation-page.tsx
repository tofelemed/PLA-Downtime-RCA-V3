import { useSearchParams } from 'react-router-dom';
import type { AnalyticsScope } from '../model/analytics-scope';
import { EconomicBreakdownCard } from '../reports/economic-breakdown-card';
import { LossValueCard } from '../reports/loss-value-card';

export function LossValuationPage({ scope }: { scope: AnalyticsScope }) {
  const [params] = useSearchParams();
  const chosen = params.get('valuation');
  const metric = chosen === 'standard_cost' || chosen === 'operational_cost' ? chosen : 'margin';
  return (
    <div className="space-y-4" data-testid="pla-valuation">
      {chosen === 'economic_impact' ? <EconomicBreakdownCard scope={scope} /> : <LossValueCard scope={scope} metric={metric} />}
    </div>
  );
}
