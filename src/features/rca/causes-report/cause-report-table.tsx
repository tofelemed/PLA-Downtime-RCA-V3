import { Link } from 'react-router-dom';
import type { RcaCauseReportItemView } from '@/api/v2/types/rca-cause-report';
import { currencyDigits, entriesInCurrency } from '@/features/display-currency/money-format';
import { useDisplayCurrency } from '@/features/display-currency/use-display-currency';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { Quantity } from '@/features/ux-kit/quantity';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { causeCasesHref } from './cause-report-model';

/** The approved loss in the display currency as the server reported it; null amount = not valued (never 0). */
function LossCell({ item, currency }: { item: RcaCauseReportItemView; currency: string }) {
  const values = item.approvedLoss.values ?? [];
  if (item.approvedLoss.lines === 0 || values.length === 0) return <span className="text-muted-foreground">No approved loss</span>;
  return (
    <span className="flex flex-col items-end" data-testid="cause-report-loss">
      {entriesInCurrency(values, (value) => value.currency, currency).map((value) => (
        <span key={value.currency} data-status={value.status}>
          {value.amount === null ? (
            <span className="text-muted-foreground">Not valued</span>
          ) : (
            <Quantity value={value.amount} uom={value.currency} fractionDigits={currencyDigits(value.currency)} />
          )}
          {value.status === 'mixed' && <span className="ml-1 text-xs text-muted-foreground">(partly valued)</span>}
          {value.fxProvisional && <span className="ml-1 text-xs text-warning">(provisional exchange rate)</span>}
        </span>
      ))}
    </span>
  );
}

function CauseCell({ item }: { item: RcaCauseReportItemView }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span>{item.name}</span>
      {!item.active && (
        <StatusBadge tone="warning" data-testid="cause-report-retired">
          Retired
        </StatusBadge>
      )}
    </span>
  );
}

function columnsOf(number: (value: number) => string, currency: string, withMoney: boolean): Array<DataTableColumn<RcaCauseReportItemView>> {
  const columns: Array<DataTableColumn<RcaCauseReportItemView>> = [
    // the position in the server's order (its rank), not a client ranking
    { id: 'rank', header: '#', align: 'right', cell: (_, index) => number(index + 1) },
    { id: 'code', header: 'Code', nowrap: true, cell: (item) => item.code },
    { id: 'name', header: 'Cause', cell: (item) => <CauseCell item={item} /> },
    { id: 'cases', header: 'Investigations', align: 'right', cell: (item) => number(item.cases) },
    { id: 'causes', header: 'Causes recorded', align: 'right', cell: (item) => number(item.causes) },
  ];
  if (withMoney) columns.push({ id: 'loss', header: 'Approved loss', align: 'right', cell: (item) => <LossCell item={item} currency={currency} /> });
  columns.push({
    id: 'drill',
    header: 'Investigations list',
    cell: (item) => (
      <Link
        to={causeCasesHref(item.causeCodeId)}
        className="text-primary underline-offset-2 hover:underline"
        data-testid="cause-report-cases"
        data-code={item.code}
        aria-label={`Open the investigations naming ${item.code} ${item.name}`}
      >
        Open investigations
      </Link>
    ),
  });
  return columns;
}

export interface CauseReportTableProps {
  items: RcaCauseReportItemView[];
  /** false for a role without the money capability (the server leaves the amounts out) */
  withMoney: boolean;
}

/** The server's ranked causes as they come; nothing is summed or re-sorted in the browser. */
export function CauseReportTable({ items, withMoney }: CauseReportTableProps) {
  const { number } = useNumberFormat();
  const { currency } = useDisplayCurrency();
  return (
    <DataTable
      caption="Recurring causes"
      columns={columnsOf(number, currency, withMoney)}
      scrollable
      rows={items}
      getRowKey={(item) => item.causeCodeId}
      empty={{ text: 'No investigation names a cause code of the library yet.' }}
      density="compact"
    />
  );
}
