import { useLossTree } from '@/api/v2/queries/pla-analytics';
import type { LossTreeMetricParam, LossTreeView } from '@/api/v2/types/pla-analytics';
import { Label } from '@/components/ui/label';
import { entriesInCurrency } from '@/features/display-currency/money-format';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { lossTreeQuery, VALUE_METRICS, type AnalyticsScope } from '../model/analytics-scope';
import { METRIC_LABELS, shownMetricLabel } from '../model/display';
import { AnalyticsCard } from '../components/analytics-card';
import { SELECT_CLASS } from '../components/analytics-filters';
import { LossTable } from '../components/loss-table';
import { LOSS_LINES_NOTE } from '../model/links';

const TOP = 10;

export interface OpportunitiesTabProps {
  scope: AnalyticsScope;
  onChange: (patch: Partial<AnalyticsScope>) => void;
}

/**
 * Top opportunities and cost / margin impact (AN02): the largest valued losses by reason in the user's
 * display currency (USD by default, IRR on request; the server reports both, D08) for one valuation view,
 * with the server's basis label; lines without a price are shown as not valued with the reason, never as 0.
 */
export function OpportunitiesTab({ scope, onChange }: OpportunitiesTabProps) {
  const env = useEventHubEnv();
  const query = useLossTree(lossTreeQuery(scope, { metric: scope.valueMetric, groupBy: 'reason', limit: TOP }), env.timezone);
  const data = query.data?.data;
  const controls = (
    <div className="flex items-center gap-2">
      <Label htmlFor="value-metric">Value</Label>
      <select id="value-metric" data-testid="value-metric" className={SELECT_CLASS} value={scope.valueMetric} onChange={(e) => onChange({ valueMetric: e.target.value as LossTreeMetricParam })}>
        {VALUE_METRICS.map((m) => (
          <option key={m} value={m}>
            {METRIC_LABELS[m]}
          </option>
        ))}
      </select>
    </div>
  );
  return (
    <AnalyticsCard
      title={`Top ${TOP} opportunities · ${shownMetricLabel(scope.valueMetric, data)}`}
      testId="pla-opportunities"
      query={query}
      response={query.data}
      isEmpty={data !== undefined && data.groups.length === 0}
      emptyText="No loss lines in this scope."
      note={`${LOSS_LINES_NOTE} Valuation views are never added to each other.`}
      actions={controls}
    >
      {data && <Currencies data={data} />}
    </AnalyticsCard>
  );
}

function Currencies({ data }: { data: LossTreeView }) {
  const { currency } = useDisplayCurrency();
  const totals = entriesInCurrency(data.totals, (t) => t.unit, currency);
  return (
    <div className="grid gap-4 lg:grid-cols-2" data-testid="opportunities" data-metric={data.metric}>
      {totals.map((total) => (
        <section key={total.unit ?? '-'} className="space-y-1" data-testid="opportunity-currency" data-currency={total.unit ?? ''} data-status={total.status}>
          <h4 className="text-sm font-medium">{total.unit ?? 'Not valued'}</h4>
          <LossTable groups={data.groups.filter((g) => g.unit === total.unit)} total={total} metric={data.metric} groupTitle="Reason" testId="opportunity-table" />
        </section>
      ))}
      {data.truncated > 0 && <p className="text-xs text-muted-foreground">{data.truncated} smaller groups not listed; totals cover every group.</p>}
    </div>
  );
}
