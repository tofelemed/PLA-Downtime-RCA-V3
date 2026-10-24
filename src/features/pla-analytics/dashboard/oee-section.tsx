import { lazy, Suspense } from 'react';
import { useOeeReport } from '@/api/v2/queries/reports';
import { Skeleton } from '@/components/ui/skeleton';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { useCalendarPreference } from '@/lib/dates';
import { oeeQuery, type AnalyticsScope, type OeePolicy } from '../model/analytics-scope';
import { findKpi } from '../model/display';
import { reportsHref } from './dashboard-links';
import { KpiSection } from './kpi-section';
import { KpiTile, KpiTileRow } from './kpi-tile';
import { OEE_TILES, OPERATIONAL_LABEL, oeeTileSpec, oeeTileValue, RECONCILED_LABEL } from './oee-tile-model';

const OeeTrendChart = lazy(() => import('../charts/oee-trend-chart').then((m) => ({ default: m.OeeTrendChart })));
const OeeLossChart = lazy(() => import('../charts/oee-loss-chart').then((m) => ({ default: m.OeeLossChart })));

export const ASSET_UNIT_NOTE = "OEE is calculated per unit — showing the selected asset's unit.";

function useOeeFigures(scope: AnalyticsScope, policy: OeePolicy, enabled = true) {
  const env = useEventHubEnv();
  const query = useOeeReport(enabled ? oeeQuery(scope, 'unit', policy) : null, env.timezone);
  return { query, isLoading: query.isLoading, label: query.data?.data.label, total: query.data?.data.total };
}

/**
 * The OEE tiles of the scope: operational OEE with its components and the reconciled PLA OEE; with
 * `operationalOnly` (the daily report) the four operational tiles only, and the reconciled OEE is not asked.
 */
export function OeeTiles({ scope, operationalOnly = false }: { scope: AnalyticsScope; operationalOnly?: boolean }) {
  const { digits } = useCalendarPreference();
  const operational = useOeeFigures(scope, 'operational');
  const reconciled = useOeeFigures(scope, 'reconciled', !operationalOnly);
  const asked = operationalOnly ? [operational] : [operational, reconciled];
  const failed = asked.find((figures) => figures.query.isError);
  if (failed) return <DataState state={dataStateOf(failed.query)} error={failed.query.error} onRetry={() => asked.forEach((figures) => figures.query.refetch())} />;
  const labels = { operational: operational.label ?? OPERATIONAL_LABEL, reconciled: reconciled.label ?? RECONCILED_LABEL };
  const tiles = operationalOnly ? OEE_TILES.filter((def) => def.id !== 'reconciled') : OEE_TILES;
  return (
    <KpiTileRow>
      {tiles.map((def) => {
        const figures = def.id === 'reconciled' ? reconciled : operational;
        const view = findKpi(figures.total, def.metric);
        const value = figures.isLoading ? <Skeleton className="h-8 w-20" /> : <span data-testid="oee-tile-value">{oeeTileValue(view, digits) ?? '—'}</span>;
        return <KpiTile key={def.id} spec={oeeTileSpec(def, view, labels)} value={value} testId={`dashboard-oee-${def.id}-tile`} />;
      })}
    </KpiTileRow>
  );
}

/** Overview: operational OEE with its components and the reconciled PLA OEE, the OEE trend and where production was lost. */
export function OeeSection({ scope, assetSelected }: { scope: AnalyticsScope; assetSelected: boolean }) {
  const { canViewAnalysis } = useCapabilities();
  const link = canViewAnalysis ? { to: reportsHref(scope, 'production'), label: 'OEE and downtime report', testId: 'dashboard-oee-report-link' } : undefined;
  return (
    <KpiSection title="OEE" link={link}>
      <div className="space-y-4" data-testid="dashboard-oee">
        {assetSelected && (
          <p className="text-xs text-muted-foreground" data-testid="dashboard-oee-asset-note">
            {ASSET_UNIT_NOTE}
          </p>
        )}
        <OeeTiles scope={scope} />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <OeeTrendChart scope={scope} />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <OeeLossChart scope={scope} />
          </Suspense>
        </div>
      </div>
    </KpiSection>
  );
}
