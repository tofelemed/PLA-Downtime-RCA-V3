import { useCapabilities } from '@/features/auth/use-capabilities';
import { useState } from 'react';
import { useLossTree } from '@/api/v2/queries/pla-analytics';
import type { LossTreeView } from '@/api/v2/types/pla-analytics';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
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
  const [chosen, setMetric] = useState<LostProductionMetric>('qty');
  // QA re-test N1: no money for operators — the Lost value view is not offered (the server refuses it too)
  const { canViewMoney } = useCapabilities();
  const metric: LostProductionMetric = canViewMoney ? chosen : 'qty';
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
      info="Availability losses of the plan ledger: approved lines where the period is approved, else its current calculation."
      actions={canViewMoney &&
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

/**
 * QA N2: a value view shows the table of the header's display currency only (USD by default); when the
 * scope has no amount in that currency, every currency's table is shown. Quantities: one per unit of measure.
 */
function shownTotals(data: LossTreeView, currency: string): LossTreeView['totals'] {
  if (data.metric === 'qty') return data.totals;
  const inCurrency = data.totals.filter((total) => total.unit === currency);
  return inCurrency.length > 0 ? inCurrency : data.totals;
}

/** One ranked table per unit of measure or currency (amounts in different units are never added). */
export function LostProductionBody({ data }: { data: LossTreeView }) {
  const { currency } = useDisplayCurrency();
  const totals = shownTotals(data, currency);
  return (
    <div className="space-y-3">
      {totals.map((total) => (
        <div key={total.unit ?? '-'} className="space-y-1">
          {totals.length > 1 && <p className="text-sm font-medium">{total.unit ?? 'Unknown unit'}</p>}
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
