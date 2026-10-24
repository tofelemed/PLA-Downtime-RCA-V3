import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ControllableSwitch } from '@/features/downtime-analysis/components/controllable-switch';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import type { AnalyticsScope } from '../model/analytics-scope';
import { downtimeHref } from './dashboard-links';
import { DOWNTIME_ASSET_NOTE } from './downtime-tile-model';
import { DowntimePareto } from './downtime-pareto';
import { DowntimeTiles } from './downtime-tiles';
import { DowntimeTrendChart } from './downtime-trend-chart';
import { KpiSection } from './kpi-section';
import { useDowntimeSeries } from './use-downtime-series';

/** Downtime of the window: totals by class, stops and scheduled availability, the planned/unplanned trend and the unplanned causes. */
export function DowntimeSection({ scope, assetId }: { scope: AnalyticsScope; assetId?: string }) {
  const { canViewAnalysis } = useCapabilities();
  const [controllable, setControllable] = useState(false);
  const series = useDowntimeSeries(scope, assetId);
  const { query } = series;
  const subtitle = assetId ? DOWNTIME_ASSET_NOTE : undefined;
  const link = canViewAnalysis ? { to: downtimeHref(scope), label: 'Downtime analysis', testId: 'dashboard-downtime-link' } : undefined;
  const controls = <ControllableSwitch checked={controllable} onChange={setControllable} testId="dashboard-controllable-switch" />;
  return (
    <KpiSection title="Downtime" link={link} controls={controls}>
      <div className="space-y-4" data-testid="dashboard-downtime">
        {query.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <DataState state={dataStateOf(query)} error={query.error} onRetry={() => query.refetch()}>
            <DowntimeTiles summary={series.summary} asset={series.asset} controllable={controllable} />
            <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
              <DowntimeTrendChart steps={series.steps} subtitle={subtitle} />
              <DowntimePareto groups={series.pareto} subtitle={subtitle} />
            </div>
          </DataState>
        )}
      </div>
    </KpiSection>
  );
}
