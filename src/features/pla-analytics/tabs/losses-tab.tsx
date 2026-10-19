import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { AnalysisModeSelect } from '@/features/analysis-navigation/analysis-mode-select';
import { useCapabilities } from '@/features/auth/use-capabilities';
import type { AnalyticsScope } from '../model/analytics-scope';
import { breakdownModesFor } from '../model/money-access';

const PAGES = {
  tree: lazy(() => import('./loss-tree-tab').then((module) => ({ default: module.LossTreeTab }))),
  opportunities: lazy(() => import('./opportunities-tab').then((module) => ({ default: module.OpportunitiesTab }))),
  'repeat-causes': lazy(() => import('./repeat-causes-tab').then((module) => ({ default: module.RepeatCausesTab }))),
  'loss-events': lazy(() => import('./loss-events').then((module) => ({ default: module.LossEvents }))),
};
const MODES = [{ value: 'tree', label: 'Loss tree' }, { value: 'opportunities', label: 'Top opportunities' }, { value: 'repeat-causes', label: 'Repeat causes' }, { value: 'loss-events', label: 'Loss events' }];
export interface LossesTabProps { scope: AnalyticsScope; onChange: (patch: Partial<AnalyticsScope>) => void; }

export function LossesTab({ scope, onChange }: LossesTabProps) {
  const [params] = useSearchParams();
  const modes = breakdownModesFor(MODES, useCapabilities().canViewMoney);
  const asked = params.get('breakdown');
  const key = modes.some((mode) => mode.value === asked) ? asked : null;
  const Content = PAGES[key && key in PAGES ? key as keyof typeof PAGES : 'tree'];
  return (
    <div className="space-y-4">
      <AnalysisModeSelect param="breakdown" label="Explore" options={modes} />
      {key === 'loss-events' && <p className="text-xs text-muted-foreground">Events are current operational records for these units and dates; ledger and approved-revision filters do not restrict this list.</p>}
      <Suspense fallback={<Skeleton className="h-64 w-full" />}><Content scope={scope} onChange={onChange} /></Suspense>
    </div>
  );
}
