import { useReport } from '@/api/v2/queries/reports';
import type { LossValueReportView } from '@/api/v2/types/period-overview';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { LocalizedNumber } from '@/features/ux-kit/localized-number';
import { useCalendarPreference } from '@/lib/dates';
import { LEDGER_LABELS } from '@/features/ux-kit/labels';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { entriesInCurrency } from '@/features/display-currency/money-format';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { AnalyticsCard } from '../components/analytics-card';
import { lossValueQuery, type AnalyticsScope } from '../model/analytics-scope';
import { revisionSelectionLabel } from '../model/links';
import { valueText } from '../model/display';

/** Nothing in this view is valued (e.g. no standard cost in the policy): say so, not "Provisional". */
const nothingValued = (data: LossValueReportView | undefined) => data !== undefined && data.total.currencies.length > 0 && data.total.currencies.every((c) => c.status === 'unvalued');

type ValueRow = LossValueReportView['groups'][number];

function columnsOf(currencies: readonly string[], unitName: (id: string) => string): Array<DataTableColumn<ValueRow>> {
  return [
    {
      id: 'unit',
      header: 'Unit',
      cell: (row) => (
        <span data-testid="report-value-row" data-key={row.key}>
          {unitName(row.key)}
        </span>
      ),
    },
    ...currencies.map<DataTableColumn<ValueRow>>((currency) => ({
      id: currency,
      header: currency,
      align: 'right',
      nowrap: true,
      cell: (row) => {
        const value = row.currencies.find((entry) => entry.currency === currency);
        return value ? <LocalizedNumber text={valueText(value)} /> : '—';
      },
    })),
  ];
}

/**
 * Loss value per unit (Reports, 2.6): the contribution-margin view of the chosen ledger in the user's
 * display currency first (the server reports both IRR and USD, D08); a missing amount says why (policy not
 * approved, FX rate missing), never 0. Units 20 per page; the total below.
 */
export function LossValueCard({ scope, metric = 'margin' }: { scope: AnalyticsScope; metric?: 'margin' | 'standard_cost' | 'operational_cost' }) {
  const env = useEventHubEnv();
  const reportQuery = { ...lossValueQuery(scope), metric };
  const query = useReport<LossValueReportView>('loss-value', reportQuery, env.timezone);
  const data = query.data?.data;
  const label = { margin: 'contribution margin', standard_cost: 'standard cost', operational_cost: 'operational cost' }[metric];
  const { currency } = useDisplayCurrency();
  const { digits } = useCalendarPreference();
  const currencies = entriesInCurrency(data?.total.currencies.map((c) => c.currency) ?? [], (c) => c, currency);
  const unvalued = nothingValued(data);
  const approved = data?.valuationStatus === 'approved';
  return (
    <AnalyticsCard
      title={`Loss value · ${data?.label ?? label} · ${LEDGER_LABELS[scope.ledger].toLowerCase()}`}
      testId="report-loss-value"
      query={query}
      response={query.data && unvalued && approved ? { ...query.data, isProvisional: false } : query.data}
      approvedOnly={scope.approvedOnly}
      isEmpty={data?.groups.length === 0}
      emptyText="Nothing valued in these periods."
      note={`Valued from each period's calculation · ${revisionSelectionLabel(scope.approvedOnly).toLowerCase()}.`}
      actions={unvalued ? <Badge variant="outline" data-testid="report-value-not-valued">Not valued</Badge> : undefined}
    >
      {data && (
        <div className="space-y-2">
          <DataTable caption="Loss value by unit" columns={columnsOf(currencies, env.unitName)} rows={data.groups} getRowKey={(row) => row.key} density="compact" />
          <p className="text-sm font-medium" data-testid="report-value-total">
            Total:{' '}
            {currencies
              .map((c) => {
                const value = data.total.currencies.find((entry) => entry.currency === c);
                return value ? valueText(value, digits) : `— ${c}`;
              })
              .join(' · ')}
          </p>
        </div>
      )}
    </AnalyticsCard>
  );
}
