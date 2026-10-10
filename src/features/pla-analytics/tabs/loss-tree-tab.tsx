import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLossTree } from '@/api/v2/queries/pla-analytics';
import type { LossTreeGroupBy, LossTreeMetric, LossTreeView } from '@/api/v2/types/pla-analytics';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { ReportCard } from '@/features/downtime-analysis/components/report-card';
import { LOSS_GROUPS, LOSS_METRICS, lossTreeQuery, type AnalyticsScope } from '../model/analytics-scope';
import { LOSS_GROUP_LABELS, METRIC_LABELS } from '../model/display';
import { SELECT_CLASS } from '../components/analytics-filters';
import { LossTable } from '../components/loss-table';

const LossTreemap = lazy(() => import('../charts/loss-treemap').then((m) => ({ default: m.LossTreemap })));

export interface LossTreeTabProps {
  scope: AnalyticsScope;
  onChange: (patch: Partial<AnalyticsScope>) => void;
}

/**
 * Loss tree (AN02): the shown runs' loss lines per reason, impact, OEE component, kind or unit, as lost
 * quantity or one valuation view (margin, standard cost, operational cost — never added together), largest
 * first with the cumulative share; grouping and metric go to the server (`groupBy`, `metric`).
 */
export function LossTreeTab({ scope, onChange }: LossTreeTabProps) {
  const env = useEventHubEnv();
  const query = useLossTree(lossTreeQuery(scope), env.timezone);
  const data = query.data?.data;
  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      <Label htmlFor="loss-group">Group by</Label>
      <select id="loss-group" data-testid="loss-group-by" className={SELECT_CLASS} value={scope.lossGroupBy} onChange={(e) => onChange({ lossGroupBy: e.target.value as LossTreeGroupBy })}>
        {LOSS_GROUPS.map((g) => (
          <option key={g} value={g}>
            {LOSS_GROUP_LABELS[g]}
          </option>
        ))}
      </select>
      <Label htmlFor="loss-metric">Metric</Label>
      <select id="loss-metric" data-testid="loss-metric" className={SELECT_CLASS} value={scope.lossMetric} onChange={(e) => onChange({ lossMetric: e.target.value as LossTreeMetric })}>
        {LOSS_METRICS.map((m) => (
          <option key={m} value={m}>
            {METRIC_LABELS[m]}
          </option>
        ))}
      </select>
    </div>
  );
  return (
    <ReportCard
      title={`Loss tree · ${METRIC_LABELS[scope.lossMetric]} by ${LOSS_GROUP_LABELS[scope.lossGroupBy].toLowerCase()} · ${scope.ledger} ledger`}
      testId="pla-loss-tree"
      query={query}
      response={query.data}
      isEmpty={data !== undefined && data.groups.length === 0}
      emptyText="No loss lines in this scope."
      note={data ? `Basis: ${data.basis}.` : undefined}
      actions={controls}
    >
      {data && <LossTreeBody data={data} />}
      <p className="text-xs">
        <Link className="underline" to={`/downtime?from=${encodeURIComponent(scope.from)}&to=${encodeURIComponent(scope.to)}${scope.unitIds.length ? `&units=${scope.unitIds.join(',')}` : ''}`}>
          Drill into the stops of this scope (Downtime Analysis)
        </Link>
      </p>
    </ReportCard>
  );
}

function LossTreeBody({ data }: { data: LossTreeView }) {
  const units = data.totals.map((t) => t.unit);
  const { currency } = useDisplayCurrency();
  const [chosen, setChosen] = useState<string | null>(null);
  const fallback = units.includes(currency) ? currency : (units[0] ?? null);
  const unit = chosen !== null && units.includes(chosen) ? chosen : fallback;
  const groups = data.groups.filter((g) => g.unit === unit);
  return (
    <div className="space-y-2" data-testid="loss-tree" data-group-by={data.groupBy} data-metric={data.metric}>
      {units.length > 1 && (
        <div className="flex gap-2 text-sm" role="radiogroup" aria-label="Unit or currency">
          {units.map((u) => (
            <label key={u ?? '-'} className="flex items-center gap-1">
              <input type="radio" name="loss-unit" checked={u === unit} onChange={() => setChosen(u)} />
              {u ?? 'unknown unit'}
            </label>
          ))}
        </div>
      )}
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <LossTreemap groups={groups} unit={unit} />
      </Suspense>
      <LossTable groups={groups} total={data.totals.find((t) => t.unit === unit)} metric={data.metric} groupTitle={LOSS_GROUP_LABELS[data.groupBy]} testId="loss-table" />
    </div>
  );
}
