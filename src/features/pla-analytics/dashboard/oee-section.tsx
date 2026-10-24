import { lazy, Suspense } from 'react';
import { useOeeReport } from '@/api/v2/queries/reports';
import { Skeleton } from '@/components/ui/skeleton';
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

function useOeeFigures(scope: AnalyticsScope, policy: OeePolicy) {
  const env = useEventHubEnv();
  const query = useOeeReport(oeeQuery(scope, 'unit', policy), env.timezone);
  return { isLoading: query.isLoading, label: query.data?.data.label, total: query.data?.data.total };
}

export function OeeTiles({ scope }: { scope: AnalyticsScope }) {
  const { digits } = useCalendarPreference();
  const operational = useOeeFigures(scope, 'operational');
  const reconciled = useOeeFigures(scope, 'reconciled');
  const labels = { operational: operational.label ?? OPERATIONAL_LABEL, reconciled: reconciled.label ?? RECONCILED_LABEL };
  return (
    <KpiTileRow>
      {OEE_TILES.map((def) => {
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
        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
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
