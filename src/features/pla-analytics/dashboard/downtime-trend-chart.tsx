import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { DataState } from '@/features/ux-kit/data-state';
import { shownClasses, type DowntimeStep } from './downtime-series-model';

const DowntimeTrendBars = lazy(() => import('../charts/downtime-trend-bars').then((m) => ({ default: m.DowntimeTrendBars })));

/** Downtime per step by schedule class with the stop count; External and Unknown are drawn (and listed) only when a step has a value; no steps → the empty state. */
export function DowntimeTrendChart({ steps, subtitle }: { steps: readonly DowntimeStep[]; subtitle?: string }) {
  return (
    <div className="space-y-2" data-testid="downtime-trend">
      <h3 className="text-sm font-medium">Downtime trend</h3>
      {subtitle && (
        <p className="text-xs text-muted-foreground" data-testid="downtime-trend-subtitle">
          {subtitle}
        </p>
      )}
      <DataState state={steps.length === 0 ? 'empty' : 'ready'} detail="No downtime in this window.">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <DowntimeTrendBars rows={steps} classes={shownClasses(steps)} />
        </Suspense>
      </DataState>
    </div>
  );
}
