import { useSearchParams } from 'react-router-dom';
import { AnalysisModeSelect } from '@/features/analysis-navigation/analysis-mode-select';
import type { AnalyticsScope } from '../model/analytics-scope';
import { EconomicBreakdownCard } from '../reports/economic-breakdown-card';
import { LossValueCard } from '../reports/loss-value-card';

const MODES = [{ value: 'margin', label: 'Contribution margin' }, { value: 'standard_cost', label: 'Standard cost' }, { value: 'operational_cost', label: 'Operational cost' }, { value: 'economic_impact', label: 'Economic impact components' }];

export function LossValuationPage({ scope }: { scope: AnalyticsScope }) {
  const [params] = useSearchParams();
  const chosen = params.get('valuation');
  const metric = chosen === 'standard_cost' || chosen === 'operational_cost' ? chosen : 'margin';
  return (
    <div className="space-y-4" data-testid="pla-valuation">
      <AnalysisModeSelect param="valuation" label="Valuation basis" options={MODES} />
      <p className="text-sm text-muted-foreground">Values use the approved policy, effective rates and FX captured by each period calculation. Missing policy, price or FX remains unvalued with its reason. The currency follows the choice in the page header.</p>
      {chosen === 'economic_impact' ? <EconomicBreakdownCard scope={scope} /> : <LossValueCard scope={scope} metric={metric} />}
    </div>
  );
}
