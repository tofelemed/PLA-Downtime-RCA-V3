import { lazy, Suspense } from 'react';
import type { DowntimeGroupView } from '@/api/v2/types/reports';
import { Skeleton } from '@/components/ui/skeleton';
import { DataState } from '@/features/ux-kit/data-state';

const DowntimeParetoBars = lazy(() => import('../charts/downtime-pareto-bars').then((m) => ({ default: m.DowntimeParetoBars })));

const reasonName = (group: DowntimeGroupView) => group.label ?? 'Not categorised';

/** The five largest unplanned stop reasons: server value as bars, server cumulative share as the line. */
export function DowntimePareto({ groups, subtitle }: { groups: readonly DowntimeGroupView[]; subtitle?: string }) {
  const rows = groups.map((group) => ({ name: reasonName(group), value: group.value, cumulativeShare: group.cumulativeShare }));
  return (
    <div className="space-y-2" data-testid="downtime-pareto">
      <h3 className="text-sm font-medium">Top unplanned causes</h3>
      {subtitle && (
        <p className="text-xs text-muted-foreground" data-testid="downtime-pareto-subtitle">
          {subtitle}
        </p>
      )}
      <DataState state={rows.length === 0 ? 'empty' : 'ready'} detail="No unplanned stops in this window.">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <DowntimeParetoBars rows={rows} />
        </Suspense>
      </DataState>
    </div>
  );
}
