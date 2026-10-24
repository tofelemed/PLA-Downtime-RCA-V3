import { lazy, Suspense } from 'react';
import { useReliabilityTrend } from '@/api/v2/queries/ops-reports';
import { Skeleton } from '@/components/ui/skeleton';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { monthLabelOf } from '@/features/month-close/model/month-label';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { useCalendarPreference } from '@/lib/dates';
import { StatusIcon } from '@/lib/icons';
import { scopeBase, type AnalyticsScope } from '../model/analytics-scope';
import type { DashboardNode } from '../model/dashboard-scope';
import { FALLING_MTBF_CHIP, reliabilityScope } from './reliability-model';

const MtbfTrendLines = lazy(() => import('../charts/mtbf-trend-lines').then((m) => ({ default: m.MtbfTrendLines })));

function FallingChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-warning px-2 py-0.5 text-xs font-medium text-warning" data-testid="mtbf-falling-chip">
      <StatusIcon.warning aria-hidden="true" className="h-3.5 w-3.5" />
      {FALLING_MTBF_CHIP}
    </span>
  );
}

/** MTBF and MTTR by plant month for the selected node (the server's total series); a period under 3 months shows the last 6 months. */
export function MtbfTrendChart({ scope, node }: { scope: AnalyticsScope; node: DashboardNode }) {
  const env = useEventHubEnv();
  const pref = useCalendarPreference();
  const reliability = reliabilityScope(scope, node);
  const base = scopeBase(reliability.scope);
  const query = useReliabilityTrend(node.assetId ? { ...base, assetIds: [node.assetId] } : base, env.timezone);
  const total = query.data?.data.total;
  const rows = (total?.months ?? []).map((entry) => ({ label: monthLabelOf(entry.month, pref.calendar, pref.digits), mtbf: entry.row.mtbf.value, mttr: entry.row.mttr.value }));
  const state = dataStateOf(query, { isEmpty: rows.length === 0 });
  return (
    <div className="space-y-2" data-testid="mtbf-trend">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">MTBF and MTTR</h3>
        {total?.fallingMtbf === true && <FallingChip />}
      </div>
      <p className="text-xs text-muted-foreground" data-testid="mtbf-trend-subtitle">
        {reliability.subtitle}
      </p>
      {query.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <DataState state={state} error={query.error} onRetry={() => query.refetch()} detail="No calculated periods in these months.">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <MtbfTrendLines rows={rows} />
          </Suspense>
        </DataState>
      )}
    </div>
  );
}
