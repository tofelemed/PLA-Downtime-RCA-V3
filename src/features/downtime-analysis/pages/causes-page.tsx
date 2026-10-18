import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnalysisModeSelect } from '@/features/analysis-navigation/analysis-mode-select';
import { BadActors } from '../components/bad-actors';
import { DrillEvents } from '../components/drill-events';
import { LostProductionPareto } from '../components/lost-production-pareto';
import { ReasonPareto } from '../components/reason-pareto';
import { pageViews } from '../model/bundle-views';
import { toSearchParams } from '../model/downtime-filters';
import type { DrillSelection } from '../model/reason-drill';
import type { DowntimePageProps } from './page-types';

const MODES = [{ value: 'lost-production', label: 'Lost production' }, { value: 'reasons', label: 'Downtime reasons' }, { value: 'assets', label: 'Assets / bad actors' }];

export function DowntimeCausesPage({ filters, bundle, onChange }: DowntimePageProps) {
  const [params] = useSearchParams();
  const mode = params.get('analysis');
  const key = toSearchParams(filters).toString();
  const [drill, setDrill] = useState<{ key: string; selection: DrillSelection } | null>(null);
  return (
    <div className="space-y-4" data-testid="downtime-view-causes">
      <AnalysisModeSelect param="analysis" label="Rank by" options={MODES} />
      {mode === 'reasons' ? <ReasonPareto filters={filters} onChange={onChange} onEvents={(selection) => setDrill({ key, selection })} />
        : mode === 'assets' ? <BadActors bundle={bundle} views={pageViews(filters)} /> : <LostProductionPareto filters={filters} />}
      {mode === 'reasons' && drill?.key === key && <DrillEvents filters={filters} selection={drill.selection} onDismiss={() => setDrill(null)} />}
    </div>
  );
}
