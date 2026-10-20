import { useLossTree } from '@/api/v2/queries/pla-analytics';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { AnalyticsCard } from '@/features/pla-analytics/components/analytics-card';
import { LossTable } from '@/features/pla-analytics/components/loss-table';
import { lossTreeQuery, type AnalyticsScope } from '@/features/pla-analytics/model/analytics-scope';
import { lossLinesNote } from '@/features/pla-analytics/model/links';

const TOP = 5;

/** The largest losses by reason, in tonnes or (with money access) the default valuation: one server read each. */
function TopLosses({ scope, metric }: { scope: AnalyticsScope; metric: 'qty' | 'value' }) {
  const env = useEventHubEnv();
  const { currency } = useDisplayCurrency();
  const query = useLossTree(lossTreeQuery({ ...scope, ledger: 'plan' }, { groupBy: 'reason', metric, limit: TOP }), env.timezone);
  const data = query.data?.data;
  const units = data?.totals.map((t) => t.unit) ?? [];
  const unit = metric === 'value' && units.includes(currency) ? currency : (units[0] ?? null);
  const title = metric === 'qty' ? `Top ${TOP} losses (quantity)` : `Top ${TOP} losses (value)`;
  return (
    <AnalyticsCard title={title} testId={`daily-top-losses-${metric}`} query={query} response={query.data} approvedOnly={scope.approvedOnly} isEmpty={data !== undefined && data.groups.length === 0} emptyText="No loss lines on these dates." note={lossLinesNote(scope.approvedOnly)}>
      {data && <LossTable groups={data.groups.filter((g) => g.unit === unit)} total={data.totals.find((t) => t.unit === unit)} metric={data.metric} groupTitle="Reason" testId={`daily-loss-table-${metric}`} />}
    </AnalyticsCard>
  );
}

/** R1: the five largest losses of the window against the plan, by quantity and — for money roles — by value. */
export function TopLossesCards({ scope }: { scope: AnalyticsScope }) {
  const { canViewMoney } = useCapabilities();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <TopLosses scope={scope} metric="qty" />
      {canViewMoney && <TopLosses scope={scope} metric="value" />}
    </div>
  );
}
