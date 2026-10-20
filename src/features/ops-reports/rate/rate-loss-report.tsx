import { useRateLoss } from '@/api/v2/queries/ops-reports';
import type { RateLossMonthView } from '@/api/v2/types/ops-reports';
import type { KpiAggregateView } from '@/api/v2/types/reports';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { monthLabelOf } from '@/features/month-close/model/month-label';
import { AnalyticsCard } from '@/features/pla-analytics/components/analytics-card';
import { scopeBase, type AnalyticsScope } from '@/features/pla-analytics/model/analytics-scope';
import { kpiText } from '@/features/pla-analytics/model/display';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DurationText } from '@/features/ux-kit/duration-text';
import { LocalizedNumber } from '@/features/ux-kit/localized-number';
import { useCalendarPreference } from '@/lib/dates';
import { LossBreakdownCards } from '../components/loss-breakdown-cards';

const seconds = (view: KpiAggregateView) => (view.value === null ? '—' : <DurationText seconds={view.value} />);

function RateLossTrend({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const pref = useCalendarPreference();
  const query = useRateLoss(scopeBase(scope), env.timezone);
  const data = query.data?.data;
  const columns: Array<DataTableColumn<RateLossMonthView>> = [
    { id: 'month', header: 'Month', cell: (m) => <span data-testid="rate-loss-month">{monthLabelOf(m.month, 'gregorian', pref.digits)}</span> },
    { id: 'equivalent', header: 'Equivalent downtime', align: 'right', nowrap: true, cell: (m) => seconds(m.equivalentDowntime) },
    { id: 'performance', header: 'Performance', align: 'right', nowrap: true, cell: (m) => <LocalizedNumber text={kpiText(m.performance, pref.digits)} /> },
  ];
  return (
    <AnalyticsCard title="Running below rate, by month" testId="rate-loss-trend" query={query} response={query.data} approvedOnly={scope.approvedOnly} isEmpty={data !== undefined && data.months.length === 0} emptyText="No calculated periods on these dates." note="Equivalent downtime: the rate lost by slowdowns as time at the reference rate.">
      {data && (
        <div className="space-y-2">
          <DataTable caption="Running below rate, by month" columns={columns} rows={data.months} getRowKey={(m) => m.month} density="compact" />
          <p className="text-sm font-medium" data-testid="rate-loss-total">
            Total: {seconds(data.total.equivalentDowntime)} equivalent downtime · performance <LocalizedNumber text={kpiText(data.total.performance, pref.digits)} />
          </p>
        </div>
      )}
    </AnalyticsCard>
  );
}

/**
 * Rate-loss analysis (R8, process engineer, plant manager): the hidden loss of running below the reference
 * rate — equivalent downtime and performance by month, and the performance loss by cause and by unit in
 * quantity and value.
 */
export function RateLossReport({ scope }: { scope: AnalyticsScope }) {
  return (
    <div className="space-y-4" data-testid="rate-loss-report">
      <RateLossTrend scope={scope} />
      <LossBreakdownCards scope={scope} groupBy="reason" kinds={['performance']} limit={15} title="Rate loss by cause" testId="rate-loss-reasons" />
      <LossBreakdownCards scope={scope} groupBy="unit" kinds={['performance']} title="Rate loss by unit" testId="rate-loss-units" />
    </div>
  );
}
