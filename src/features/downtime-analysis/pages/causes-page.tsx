import { useSearchParams } from 'react-router-dom';
import { AnalysisModeSelect } from '@/features/analysis-navigation/analysis-mode-select';
import { BadActors } from '../components/bad-actors';
import { DrillEvents } from '../components/drill-events';
import { LostProductionPareto } from '../components/lost-production-pareto';
import { ReasonPareto } from '../components/reason-pareto';
import { pageViews } from '../model/bundle-views';
import { useDrillSelection } from '../hooks/use-drill-selection';
import type { DowntimePageProps } from './page-types';

const MODES = [{ value: 'lost-production', label: 'Lost production' }, { value: 'reasons', label: 'Downtime reasons' }, { value: 'assets', label: 'Assets / bad actors' }];

export function DowntimeCausesPage({ filters, bundle, onChange }: DowntimePageProps) {
  const [params] = useSearchParams();
  const mode = params.get('analysis');
  const drill = useDrillSelection(filters, mode === 'reasons');
  return (
    <div className="space-y-4" data-testid="downtime-view-causes">
      <AnalysisModeSelect param="analysis" label="Rank by" options={MODES} />
      {mode === 'reasons' ? <ReasonPareto filters={filters} onChange={onChange} onEvents={drill.choose} />
        : mode === 'assets' ? <BadActors bundle={bundle} views={pageViews(filters)} filters={filters} /> : <LostProductionPareto filters={filters} />}
      {mode === 'reasons' && drill.selection && <DrillEvents filters={filters} selection={drill.selection} onDismiss={() => drill.choose(null)} />}
    </div>
  );
}
