import { useState } from 'react';
import { useLossTree } from '@/api/v2/queries/pla-analytics';
import type { LossTreeView } from '@/api/v2/types/pla-analytics';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { LossTable } from '@/features/pla-analytics/components/loss-table';
import type { DowntimeFilters } from '../model/downtime-filters';
import { LOST_PRODUCTION_METRICS, lostProductionQuery, type LostProductionMetric } from '../model/lost-production';
import { ReportCard } from './report-card';

const METRIC_TEXT: Record<LostProductionMetric, string> = { qty: 'Lost quantity', value: 'Lost value' };

/**
 * FE-08: what the stops cost in production — availability losses of the ledger per reason, as quantity
 * (per unit of measure) or contribution margin (per currency, never converted here); the server ranks them
 * and gives the cumulative share. Values without an approved price stay empty, never 0.
 */
export function LostProductionPareto({ filters }: { filters: DowntimeFilters }) {
  const env = useEventHubEnv();
  const [metric, setMetric] = useState<LostProductionMetric>('qty');
  const query = useLossTree(lostProductionQuery(filters, metric), env.timezone);
  const data = query.data?.data;
  return (
    <ReportCard
      title="Lost production by stop reason"
      testId="lost-production"
      query={query}
      response={query.data}
      isEmpty={data !== undefined && data.groups.length === 0}
      emptyText="No availability losses in this scope."
      note="Availability losses of the plan ledger: approved lines where the period is approved, else its current calculation."
      actions={
        <ToggleGroup type="single" size="sm" value={metric} onValueChange={(value) => value && setMetric(value as LostProductionMetric)} aria-label="Measure">
          {LOST_PRODUCTION_METRICS.map((m) => (
            <ToggleGroupItem key={m} value={m} data-testid={`lost-production-${m}`}>
              {METRIC_TEXT[m]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      }
    >
      {data && <LostProductionBody data={data} />}
    </ReportCard>
  );
}

/** One ranked table per unit of measure or currency (amounts in different units are never added). */
export function LostProductionBody({ data }: { data: LossTreeView }) {
  return (
    <div className="space-y-3">
      {data.totals.map((total) => (
        <div key={total.unit ?? '-'} className="space-y-1">
          {data.totals.length > 1 && <p className="text-sm font-medium">{total.unit ?? 'Unknown unit'}</p>}
          <LossTable
            groups={data.groups.filter((g) => g.unit === total.unit)}
            total={total}
            metric={data.metric}
            groupTitle="Reason"
            testId={`lost-production-table-${total.unit ?? 'none'}`}
          />
        </div>
      ))}
    </div>
  );
}
