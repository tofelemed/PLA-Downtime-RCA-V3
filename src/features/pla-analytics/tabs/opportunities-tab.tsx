import { useLossTree } from '@/api/v2/queries/pla-analytics';
import type { LossTreeView } from '@/api/v2/types/pla-analytics';
import { entriesInCurrency } from '@/features/display-currency/money-format';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { lossTreeQuery, type AnalyticsScope } from '../model/analytics-scope';
import { shownMetricLabel } from '../model/display';
import { AnalyticsCard } from '../components/analytics-card';
import { LossTable } from '../components/loss-table';
import { lossGroupLink, lossLinesNote, noLinkReason } from '../model/links';

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
export function OpportunitiesTab({ scope }: OpportunitiesTabProps) {
  const env = useEventHubEnv();
  const query = useLossTree(lossTreeQuery(scope, { metric: scope.valueMetric, groupBy: 'reason', limit: TOP }), env.timezone);
  const data = query.data?.data;
  return (
    <AnalyticsCard
      title={`Top ${TOP} opportunities · ${shownMetricLabel(scope.valueMetric, data)}`}
      testId="pla-opportunities"
      query={query}
      response={query.data}
      isEmpty={data !== undefined && data.groups.length === 0}
      emptyText="No loss lines in this scope."
      info={`${lossLinesNote(scope.approvedOnly)} Valuation views are never added to each other.`}
    >
      {data && <Currencies data={data} scope={scope} />}
    </AnalyticsCard>
  );
}

function Currencies({ data, scope }: { data: LossTreeView; scope: AnalyticsScope }) {
  const { currency } = useDisplayCurrency();
  const totals = entriesInCurrency(data.totals, (t) => t.unit, currency);
  return (
    <div className="grid gap-4 lg:grid-cols-2" data-testid="opportunities" data-metric={data.metric}>
      {totals.map((total) => (
        <section key={total.unit ?? '-'} className="space-y-1" data-testid="opportunity-currency" data-currency={total.unit ?? ''} data-status={total.status}>
          <h4 className="text-sm font-medium">{total.unit ?? 'Not valued'}</h4>
          <LossTable groups={data.groups.filter((g) => g.unit === total.unit)} total={total} metric={data.metric} groupTitle="Reason" testId="opportunity-table" rowLink={(group) => lossGroupLink(scope, data.groupBy, group)} noLinkReason={(group) => noLinkReason(data.groupBy, group)} />
        </section>
      ))}
      {data.truncated > 0 && <p className="text-xs text-muted-foreground">{data.truncated} smaller groups not listed; totals cover every group.</p>}
    </div>
  );
}
