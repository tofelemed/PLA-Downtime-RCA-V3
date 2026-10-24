import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLossTree } from '@/api/v2/queries/pla-analytics';
import type { LossTreeView } from '@/api/v2/types/pla-analytics';
import { Skeleton } from '@/components/ui/skeleton';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { AnalyticsCard } from '../components/analytics-card';
import { LossTable } from '../components/loss-table';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { lossTreeQuery, type AnalyticsScope } from '../model/analytics-scope';
import { scopeForMoneyAccess } from '../model/money-access';
import { inSentence, LOSS_GROUP_LABELS, shownMetricLabel } from '../model/display';
import { downtimeLink, lossLinesNote, lossGroupLink, noLinkReason } from '../model/links';

const LossTreemap = lazy(() => import('../charts/loss-treemap').then((m) => ({ default: m.LossTreemap })));

export interface LossTreeTabProps {
  scope: AnalyticsScope;
  onChange: (patch: Partial<AnalyticsScope>) => void;
}

/**
 * Loss tree (AN02): the shown runs' loss lines per reason, impact, OEE component, kind or unit, as lost
 * quantity or one valuation view (policy default, economic impact, margin, standard cost, operational cost — never added together), largest
 * first with the cumulative share; grouping and metric (filter bar) go to the server (`groupBy`, `metric`).
 */
export function LossTreeTab({ scope: shown }: LossTreeTabProps) {
  const env = useEventHubEnv();
  const scope = scopeForMoneyAccess(shown, useCapabilities().canViewMoney);
  const query = useLossTree(lossTreeQuery(scope), env.timezone);
  const data = query.data?.data;
  return (
    <AnalyticsCard
      title={`${shownMetricLabel(scope.lossMetric, data)} by ${inSentence(LOSS_GROUP_LABELS[scope.lossGroupBy])}`}
      testId="pla-loss-tree"
      query={query}
      response={query.data}
      isEmpty={data !== undefined && data.groups.length === 0}
      emptyText="No loss lines in this scope."
      info={lossLinesNote(scope.approvedOnly)}
    >
      {data && <LossTreeBody data={data} scope={scope} />}
      <p className="text-xs">
        <Link className="underline" to={downtimeLink(scope)}>
          Drill into the stops of this scope (Downtime Analysis)
        </Link>
      </p>
    </AnalyticsCard>
  );
}

function LossTreeBody({ data, scope }: { data: LossTreeView; scope: AnalyticsScope }) {
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
      <LossTable groups={groups} total={data.totals.find((t) => t.unit === unit)} metric={data.metric} groupTitle={LOSS_GROUP_LABELS[data.groupBy]} testId="loss-table" rowLink={(group) => lossGroupLink(scope, data.groupBy, group)} noLinkReason={(group) => noLinkReason(data.groupBy, group)} />
    </div>
  );
}
