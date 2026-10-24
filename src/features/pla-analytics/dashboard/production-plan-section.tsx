import { useState } from 'react';
import { useReconciliationTrend } from '@/api/v2/queries/pla-analytics';
import type { ReconciliationTrendBucketView } from '@/api/v2/types/pla-analytics';
import { Skeleton } from '@/components/ui/skeleton';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { formatRatioPercent } from '@/features/plan-dashboard/model/display';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Quantity } from '@/features/ux-kit/quantity';
import { useCalendarPreference } from '@/lib/dates';
import { trendQuery, type AnalyticsScope } from '../model/analytics-scope';
import { plaHref } from './dashboard-links';
import { KpiSection } from './kpi-section';
import { KpiTile, KpiTileRow } from './kpi-tile';
import { PLAN_ASSET_UNIT_NOTE, PLAN_TILES, defaultUom, totalsByUom } from './plan-tile-model';
import { PlanTrendChart } from './plan-trend-chart';
import { TopLossReasons } from './top-loss-reasons';
import { UomPicker } from './uom-picker';

/** The note under Unexplained: its share of the plan and of the shortfall, flagged when above the policy's target. */
function UnexplainedNotes({ total }: { total: ReconciliationTrendBucketView }) {
  const { digits } = useCalendarPreference();
  return (
    <div className="mt-1 space-y-0.5 text-xs font-normal text-muted-foreground" data-testid="plan-unexplained-notes">
      <p data-testid="plan-unexplained-of-plan">{formatRatioPercent(total.unexplainedOfPlan, digits)} of plan</p>
      <p data-testid="plan-unexplained-of-shortfall">{formatRatioPercent(total.unexplainedOfShortfall, digits)} of shortfall</p>
      {total.unexplainedAboveTarget === true && <p className="font-medium text-danger" data-testid="plan-above-target">above target</p>}
    </div>
  );
}

function PlanTiles({ total }: { total: ReconciliationTrendBucketView }) {
  return (
    <KpiTileRow>
      {PLAN_TILES.map((def) => (
        <KpiTile
          key={def.id}
          spec={{ title: def.title, info: def.info, highlight: def.highlight }}
          value={
            <>
              <span data-testid="plan-tile-value">
                <Quantity value={total[def.id]} uom={total.uom} />
              </span>
              {def.id === 'unexplained' && <UnexplainedNotes total={total} />}
            </>
          }
          testId={`dashboard-plan-${def.id}-tile`}
        />
      ))}
    </KpiTileRow>
  );
}

function PlanBody({ scope, buckets, totals }: { scope: AnalyticsScope; buckets: readonly ReconciliationTrendBucketView[]; totals: readonly ReconciliationTrendBucketView[] }) {
  const uoms = totals.map((row) => row.uom ?? '');
  const [picked, setPicked] = useState<string | null>(null);
  const uom = picked !== null && uoms.includes(picked) ? picked : defaultUom(totals);
  const total = totals.find((row) => row.uom === uom);
  if (!uom || !total) return <DataState state="empty" detail="No planned production in this window." />;
  return (
    <div className="space-y-4">
      <UomPicker uoms={uoms} value={uom} onChange={setPicked} />
      <PlanTiles total={total} />
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <PlanTrendChart scope={scope} buckets={buckets} uom={uom} />
        <TopLossReasons scope={scope} uom={uom} />
      </div>
    </div>
  );
}

/** Production vs plan: plan, actual, shortfall and how much of it is explained, per unit of measure (units are never added). */
export function ProductionPlanSection({ scope, assetSelected }: { scope: AnalyticsScope; assetSelected: boolean }) {
  const { canViewOperations } = useCapabilities();
  const env = useEventHubEnv();
  const query = useReconciliationTrend(trendQuery(scope), env.timezone);
  const data = query.data?.data;
  const totals = totalsByUom(data?.totals ?? []);
  const link = canViewOperations ? { to: plaHref(scope, '/pla-analytics/losses'), label: 'Production loss analysis', testId: 'dashboard-plan-link' } : undefined;
  const state = dataStateOf(query, { isEmpty: totals.length === 0 });
  return (
    <KpiSection title="Production vs plan" link={link}>
      <div className="space-y-4" data-testid="dashboard-plan">
        {assetSelected && (
          <p className="text-xs text-muted-foreground" data-testid="dashboard-plan-asset-note">
            {PLAN_ASSET_UNIT_NOTE}
          </p>
        )}
        {query.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <DataState state={state} error={query.error} onRetry={() => query.refetch()} detail="No planned production in this window.">
            <PlanBody scope={scope} buckets={data?.buckets ?? []} totals={totals} />
          </DataState>
        )}
      </div>
    </KpiSection>
  );
}
