import { useLossTree } from '@/api/v2/queries/pla-analytics';
import type { LossTreeMetric, LossTreeView } from '@/api/v2/types/pla-analytics';
import { Label } from '@/components/ui/label';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { ReportCard } from '@/features/downtime-analysis/components/report-card';
import { lossTreeQuery, VALUE_METRICS, type AnalyticsScope } from '../model/analytics-scope';
import { METRIC_LABELS } from '../model/display';
import { SELECT_CLASS } from '../components/analytics-filters';
import { LossTable } from '../components/loss-table';

const TOP = 10;

export interface OpportunitiesTabProps {
  scope: AnalyticsScope;
  onChange: (patch: Partial<AnalyticsScope>) => void;
}

/**
 * Top opportunities and cost / margin impact (AN02): the largest valued losses by reason in each reporting
 * currency (IRR and USD, D08) for one valuation view, with the server's basis label; lines without a price
 * are shown as not valued with the reason, never as 0.
 */
export function OpportunitiesTab({ scope, onChange }: OpportunitiesTabProps) {
  const env = useEventHubEnv();
  const query = useLossTree(lossTreeQuery(scope, { metric: scope.valueMetric, groupBy: 'reason', limit: TOP }), env.timezone);
  const data = query.data?.data;
  const controls = (
    <div className="flex items-center gap-2">
      <Label htmlFor="value-metric">Value</Label>
      <select id="value-metric" data-testid="value-metric" className={SELECT_CLASS} value={scope.valueMetric} onChange={(e) => onChange({ valueMetric: e.target.value as LossTreeMetric })}>
        {VALUE_METRICS.map((m) => (
          <option key={m} value={m}>
            {METRIC_LABELS[m]}
          </option>
        ))}
      </select>
    </div>
  );
  return (
    <ReportCard
      title={`Top ${TOP} opportunities · ${METRIC_LABELS[scope.valueMetric]}`}
      testId="pla-opportunities"
      query={query}
      response={query.data}
      isEmpty={data !== undefined && data.groups.length === 0}
      emptyText="No loss lines in this scope."
      note={data ? `Basis: ${data.basis}. Views are never added to each other.` : undefined}
      actions={controls}
    >
      {data && <Currencies data={data} />}
    </ReportCard>
  );
}

function Currencies({ data }: { data: LossTreeView }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2" data-testid="opportunities" data-metric={data.metric}>
      {data.totals.map((total) => (
        <section key={total.unit ?? '-'} className="space-y-1" data-testid="opportunity-currency" data-currency={total.unit ?? ''} data-status={total.status}>
          <h4 className="text-sm font-medium">{total.unit ?? 'Not valued'}</h4>
          <LossTable groups={data.groups.filter((g) => g.unit === total.unit)} total={total} metric={data.metric} groupTitle="Reason" testId="opportunity-table" />
        </section>
      ))}
      {data.truncated > 0 && <p className="text-xs text-muted-foreground">{data.truncated} smaller groups not listed; totals cover every group.</p>}
    </div>
  );
}
