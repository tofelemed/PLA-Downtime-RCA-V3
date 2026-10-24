import { useSearchParams } from 'react-router-dom';
import type { TrendGroup } from '@/api/v2/types/pla-analytics';
import { Label } from '@/components/ui/label';
import type { PlaView } from '@/features/analysis-navigation/analysis-pages';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { TREND_GROUPS, type AnalyticsScope, type OeePolicy } from '../model/analytics-scope';
import { TREND_LABELS } from '../model/display';
import { breakdownModesFor } from '../model/money-access';
import { BREAKDOWN_MODES, INSPECTION_MODES, SERIES_MODES, TREND_POLICY_LABELS, VALUATION_MODES } from '../model/view-modes';
import { FIELD_CLASS, SELECT_CLASS } from './analytics-filters';
import { ModeField } from './mode-field';

export interface ViewPickerProps {
  view: PlaView;
  scope: AnalyticsScope;
  onChange: (patch: Partial<AnalyticsScope>) => void;
}

/** What the page shows — its mode, trend grouping and OEE policy, or valuation basis — as filter-bar fields after Units. */
export function ViewPicker({ view, scope, onChange }: ViewPickerProps) {
  const { canViewMoney } = useCapabilities();
  if (view === 'losses') return <ModeField param="breakdown" label="Explore" options={breakdownModesFor(BREAKDOWN_MODES, canViewMoney)} />;
  if (view === 'reconciliation') return <ModeField param="inspection" label="Inspect" options={INSPECTION_MODES} />;
  if (view === 'valuation') return <ModeField param="valuation" label="Valuation basis" options={VALUATION_MODES} />;
  if (view === 'trends') return <TrendFields scope={scope} onChange={onChange} />;
  return null;
}

function TrendFields({ scope, onChange }: Omit<ViewPickerProps, 'view'>) {
  const [params] = useSearchParams();
  const mode = params.get('series');
  const grouping = mode !== 'units' && mode !== 'products';
  return (
    <>
      <ModeField param="series" label="Show" options={SERIES_MODES} />
      {grouping && (
        <div className={FIELD_CLASS}>
          <Label htmlFor="trend-by">Trend by</Label>
          <select id="trend-by" data-testid="trend-by" className={SELECT_CLASS} value={scope.trendBy} onChange={(event) => onChange({ trendBy: event.target.value as TrendGroup })}>
            {TREND_GROUPS.map((group) => (
              <option key={group} value={group}>
                {TREND_LABELS[group]}
              </option>
            ))}
          </select>
        </div>
      )}
      {mode !== 'residual' && (
        <div className={FIELD_CLASS}>
          <Label htmlFor="trend-policy">OEE</Label>
          <select id="trend-policy" data-testid="trend-policy" className={SELECT_CLASS} value={scope.policy} onChange={(event) => onChange({ policy: event.target.value as OeePolicy })}>
            <option value="operational">{TREND_POLICY_LABELS.operational}</option>
            <option value="reconciled">{TREND_POLICY_LABELS.reconciled}</option>
          </select>
        </div>
      )}
    </>
  );
}
