import { useSearchParams } from 'react-router-dom';
import { AnalysisModeSelect } from '@/features/analysis-navigation/analysis-mode-select';
import { DisplayCurrencyToggle } from '@/features/display-currency/display-currency-toggle';
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AnalysisModeSelect param="valuation" label="Valuation basis" options={MODES} />
        {chosen !== 'economic_impact' && <DisplayCurrencyToggle />}
      </div>
      <p className="text-sm text-muted-foreground">Values use the approved policy, effective rates and FX captured by each period calculation. Missing policy, price or FX remains unvalued with its reason.</p>
      {chosen === 'economic_impact' ? <EconomicBreakdownCard scope={scope} /> : <LossValueCard scope={scope} metric={metric} />}
    </div>
  );
}
