import type { EconomicComponentGroupView } from '@/api/v2/types/period-overview';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { LocalizedNumber } from '@/features/ux-kit/localized-number';
import { Quantity } from '@/features/ux-kit/quantity';
import { valuationReasonLabel } from '@/features/plan-dashboard/model/display';
import { useCalendarPreference, type DigitSystem } from '@/lib/dates';
import { breakdownMoney, breakdownRows, breakdownStatus, shownCurrency, type BreakdownRow } from './breakdown-model';

function columnsOf(currency: string, digits: DigitSystem | undefined): Array<DataTableColumn<BreakdownRow>> {
  return [
    {
      id: 'component',
      header: 'Component',
      cell: (row) => (
        <span data-testid="breakdown-row" data-key={row.key}>
          {row.label}
        </span>
      ),
    },
    {
      id: 'value',
      header: `Value (${currency})`,
      align: 'right',
      nowrap: true,
      cell: (row) => <LocalizedNumber text={breakdownMoney(row.value, currency, digits)} />,
    },
    {
      id: 'quantity',
      header: 'Quantity',
      align: 'right',
      nowrap: true,
      cell: (row) => (row.quantities.length === 0 ? '—' : row.quantities.map((q) => <Quantity key={q.uom ?? '-'} value={q.quantity} uom={q.uom} />)),
    },
    {
      id: 'status',
      header: 'Notes',
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {[breakdownStatus(row.value), ...(row.value?.reasons ?? []).filter((r) => r !== 'fx_rate_provisional').map(valuationReasonLabel)].filter(Boolean).join(' · ')}
        </span>
      ),
    },
  ];
}

/**
 * VA-04: the economic view broken down by component as the server summed it (approved revisions, else the
 * open draft), in the user's display currency (USD by default, IRR on request). Nothing is added up here.
 */
export function EconomicBreakdownTable({ components, caption }: { components: readonly EconomicComponentGroupView[]; caption: string }) {
  const display = useDisplayCurrency().currency;
  const { digits } = useCalendarPreference();
  const currency = shownCurrency(components, display);
  if (components.length === 0) return <p className="text-sm text-muted-foreground">No economic value to break down for these periods.</p>;
  return (
    <DataTable
      caption={caption}
      columns={columnsOf(currency, digits)}
      rows={breakdownRows(components, currency)}
      getRowKey={(row) => row.key}
      density="compact"
    />
  );
}
