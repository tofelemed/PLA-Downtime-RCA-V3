import { useSearchParams } from 'react-router-dom';
import { AnalysisModeSelect } from '@/features/analysis-navigation/analysis-mode-select';
import type { AnalyticsScope } from '../model/analytics-scope';
import { QualityTab } from './quality-tab';
import { ReconciliationTab } from './reconciliation-tab';

const MODES = [{ value: 'status', label: 'Reconciliation status' }, { value: 'quality', label: 'Actuals quality coverage' }];
export function ReconciliationView({ scope }: { scope: AnalyticsScope }) {
  const [params] = useSearchParams();
  return <div className="space-y-4"><AnalysisModeSelect param="inspection" label="Inspect" options={MODES} />
    {params.get('inspection') === 'quality' ? <QualityTab scope={scope} /> : <ReconciliationTab scope={scope} />}
  </div>;
}
