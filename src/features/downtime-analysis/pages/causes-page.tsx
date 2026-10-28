import { BadActors } from '../components/bad-actors';
import { DrillEvents } from '../components/drill-events';
import { LostProductionPareto } from '../components/lost-production-pareto';
import { ReasonPareto } from '../components/reason-pareto';
import { pageViews } from '../model/bundle-views';
import { useCausesMode } from '../hooks/use-causes-mode';
import { useDrillSelection } from '../hooks/use-drill-selection';
import type { DowntimePageProps } from './page-types';


export function DowntimeCausesPage({ filters, bundle, onChange }: DowntimePageProps) {
  const { mode } = useCausesMode(filters.unitIds[0]);
  const drill = useDrillSelection(filters, mode === 'reasons');
  return (
    <div className="space-y-4" data-testid="downtime-view-causes">
      {mode === 'reasons' ? <ReasonPareto filters={filters} onChange={onChange} onEvents={drill.choose} />
        : mode === 'assets' ? <BadActors bundle={bundle} views={pageViews(filters)} filters={filters} /> : <LostProductionPareto filters={filters} />}
      {mode === 'reasons' && drill.selection && <DrillEvents filters={filters} selection={drill.selection} onDismiss={() => drill.choose(null)} />}
    </div>
  );
}
