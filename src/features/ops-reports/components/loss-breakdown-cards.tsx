import { useLossTree, type LossTreeQuery } from '@/api/v2/queries/pla-analytics';
import type { LossTreeGroupBy, LossTreeView } from '@/api/v2/types/pla-analytics';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { AnalyticsCard } from '@/features/pla-analytics/components/analytics-card';
import { LossTable } from '@/features/pla-analytics/components/loss-table';
import { lossTreeQuery, type AnalyticsScope } from '@/features/pla-analytics/model/analytics-scope';
import { LOSS_GROUP_LABELS } from '@/features/pla-analytics/model/display';
import { lossLinesNote } from '@/features/pla-analytics/model/links';

export interface LossBreakdownProps {
  scope: AnalyticsScope;
  groupBy: LossTreeGroupBy;
  /** card title without the metric, e.g. "Top 5 losses" */
  title: string;
  testId: string;
  /** largest groups only (server `limit`); absent = every group */
  limit?: number;
  /** loss kinds to include (server `kinds`); absent = every kind of the tree */
  kinds?: LossTreeQuery['kinds'];
}

/** The unit (uom) or currency a breakdown is shown in: the display currency when valued in it, else the first. */
function shownUnit(data: LossTreeView | undefined, metric: 'qty' | 'value', currency: string): string | null {
  const units = data?.totals.map((t) => t.unit) ?? [];
  return metric === 'value' && units.includes(currency) ? currency : (units[0] ?? null);
}

/** The plan-ledger loss lines by one grouping, in quantity or in the default valuation: one server read each. */
function LossBreakdown({ metric, ...props }: LossBreakdownProps & { metric: 'qty' | 'value' }) {
  const env = useEventHubEnv();
  const { currency } = useDisplayCurrency();
  const options = { groupBy: props.groupBy, metric, limit: props.limit };
  const base = lossTreeQuery({ ...props.scope, ledger: 'plan' }, options);
  const query = useLossTree(props.kinds ? { ...base, kinds: props.kinds } : base, env.timezone);
  const data = query.data?.data;
  const unit = shownUnit(data, metric, currency);
  const testId = `${props.testId}-${metric}`;
  return (
    <AnalyticsCard title={`${props.title} (${metric === 'qty' ? 'quantity' : 'value'})`} testId={testId} query={query} response={query.data} approvedOnly={props.scope.approvedOnly} isEmpty={data !== undefined && data.groups.length === 0} emptyText="No loss lines on these dates." note={lossLinesNote(props.scope.approvedOnly)}>
      {data && <LossTable groups={data.groups.filter((g) => g.unit === unit)} total={data.totals.find((t) => t.unit === unit)} metric={data.metric} groupTitle={LOSS_GROUP_LABELS[props.groupBy]} testId={`${testId}-table`} />}
    </AnalyticsCard>
  );
}

/** Losses against the plan by quantity and — for roles that see money — by value, side by side (R1, R3). */
export function LossBreakdownCards(props: LossBreakdownProps) {
  const { canViewMoney } = useCapabilities();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <LossBreakdown {...props} metric="qty" />
      {canViewMoney && <LossBreakdown {...props} metric="value" />}
    </div>
  );
}
