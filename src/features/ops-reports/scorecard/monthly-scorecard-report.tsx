import { useMonthlyScorecard } from '@/api/v2/queries/ops-reports';
import type { ScorecardMonthView } from '@/api/v2/types/ops-reports';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { monthLabelOf } from '@/features/month-close/model/month-label';
import { AnalyticsCard } from '@/features/pla-analytics/components/analytics-card';
import { scopeBase, type AnalyticsScope } from '@/features/pla-analytics/model/analytics-scope';
import { findKpi, kpiText, shareText } from '@/features/pla-analytics/model/display';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { formatCurrencyAmount } from '@/features/display-currency/money-format';
import { LocalizedNumber } from '@/features/ux-kit/localized-number';
import { useCalendarPreference } from '@/lib/dates';
import { LossBreakdownCards } from '../components/loss-breakdown-cards';
import { twelveMonthWindow } from '../model/month-to-date';
import { ReportExportBar } from '../components/report-export-bar';

/** The money lost in the display currency (else the first currency), or why there is none. */
function moneyText(month: ScorecardMonthView, currency: string): string {
  const value = month.lossValue.find((v) => v.currency === currency) ?? month.lossValue[0];
  if (!value) return '—';
  return value.amount === null ? 'Not fully valued' : formatCurrencyAmount(value.amount, value.currency ?? currency);
}

function useColumns(): Array<DataTableColumn<ScorecardMonthView>> {
  const { digits } = useCalendarPreference();
  const { currency } = useDisplayCurrency();
  const { canViewMoney } = useCapabilities();
  const kpi = (metric: string) => (m: ScorecardMonthView) => <LocalizedNumber text={kpiText(findKpi(m.oee, metric), digits)} />;
  const output = (field: 'utilisation' | 'lossShare' | 'planAttainment') => (m: ScorecardMonthView) => <LocalizedNumber text={m.output.length === 1 ? shareText(m.output[0][field], digits) : m.output.length ? 'Several units of measure' : '—'} />;
  return [
    { id: 'month', header: 'Month', nowrap: true, cell: (m) => <span data-testid="scorecard-month">{monthLabelOf(m.month, 'gregorian', digits)}</span> },
    { id: 'oee', header: 'OEE', align: 'right', cell: kpi('oee') },
    { id: 'availability', header: 'Availability', align: 'right', cell: kpi('availability') },
    { id: 'performance', header: 'Performance', align: 'right', cell: kpi('performance') },
    { id: 'quality', header: 'Quality', align: 'right', cell: kpi('quality') },
    { id: 'utilisation', header: 'Utilisation', align: 'right', cell: output('utilisation') },
    { id: 'lossShare', header: 'Capacity lost', align: 'right', cell: output('lossShare') },
    { id: 'attainment', header: 'Plan attainment', align: 'right', cell: output('planAttainment') },
    ...(canViewMoney ? [{ id: 'money', header: 'Loss value', align: 'right' as const, nowrap: true, cell: (m: ScorecardMonthView) => moneyText(m, currency) }] : []),
  ];
}

/**
 * Monthly executive scorecard (R12, plant manager, executives): twelve months of OEE and its components,
 * utilisation of capacity, the share of capacity lost, plan attainment and the money lost, then the three
 * largest loss themes of those months. Targets and budget comparisons wait for the targets decision (T1).
 */
export function MonthlyScorecardReport({ scope, dayStart }: { scope: AnalyticsScope; dayStart: string }) {
  const env = useEventHubEnv();
  const columns = useColumns();
  const span = twelveMonthWindow(scope, dayStart, env.timezone);
  const months = span ? { ...scope, ...span, windowLabel: '12 months' } : null;
  const query = useMonthlyScorecard(months ? scopeBase(months) : null, env.timezone);
  const data = query.data?.data;
  return (
    <div className="space-y-4" data-testid="monthly-scorecard">
      <ReportExportBar kind="scorecard" query={months ? scopeBase(months) : null} timezone={env.timezone} />
      <AnalyticsCard title="Twelve-month scorecard" testId="scorecard-table" query={query} response={query.data} approvedOnly={scope.approvedOnly} isEmpty={data !== undefined && data.months.length === 0} emptyText="No calculated periods in these twelve months.">
        {data && <DataTable caption="Twelve-month scorecard" columns={columns} rows={data.months} getRowKey={(m) => m.month} density="compact" />}
      </AnalyticsCard>
      {months && <LossBreakdownCards scope={months} groupBy="reason" limit={3} title="Top 3 loss themes, twelve months" testId="scorecard-themes" />}
    </div>
  );
}
