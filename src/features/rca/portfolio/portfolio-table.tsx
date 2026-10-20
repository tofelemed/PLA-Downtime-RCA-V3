import { Link } from 'react-router-dom';
import type { RcaPortfolioRowView } from '@/api/v2/types/rca-portfolio';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { ActionsCell, ApprovedLossCell, CasesCell, CauseCell, ClaimedCell, RealizedCell, VerdictsCell } from './portfolio-cells';
import { portfolioCasesHref } from './portfolio-model';

function DrillCell({ row }: { row: RcaPortfolioRowView }) {
  const href = portfolioCasesHref(row.causeCode?.id ?? null);
  if (!href || !row.causeCode) return <span className="text-muted-foreground">See the investigations listed</span>;
  return (
    <Link to={href} className="text-primary underline-offset-2 hover:underline" data-testid="portfolio-drill" data-code={row.causeCode.code}>
      All investigations of {row.causeCode.code}
    </Link>
  );
}

function columnsOf(number: (value: number) => string, currency: string, withMoney: boolean): Array<DataTableColumn<RcaPortfolioRowView>> {
  const money = (column: DataTableColumn<RcaPortfolioRowView>) => (withMoney ? [column] : []);
  return [
    // the position in the server's order, not a client ranking
    { id: 'rank', header: '#', align: 'right', cell: (_, index) => number(index + 1) },
    { id: 'cause', header: 'Cause', cell: (row) => <CauseCell row={row} /> },
    { id: 'cases', header: 'Investigations', cell: (row) => <CasesCell row={row} /> },
    ...money({ id: 'approved', header: `Approved loss (${currency})`, align: 'right', cell: (row) => <ApprovedLossCell row={row} currency={currency} /> }),
    { id: 'actions', header: 'Actions', cell: (row) => <ActionsCell row={row} /> },
    { id: 'verdicts', header: 'Effectiveness', cell: (row) => <VerdictsCell row={row} /> },
    ...money({ id: 'claimed', header: `Claimed avoided (${currency})`, align: 'right', cell: (row) => <ClaimedCell row={row} currency={currency} /> }),
    { id: 'realized', header: 'Realised difference', align: 'right', cell: (row) => <RealizedCell row={row} /> },
    { id: 'drill', header: 'Investigations list', cell: (row) => <DrillCell row={row} /> },
  ];
}

export interface PortfolioTableProps {
  rows: RcaPortfolioRowView[];
  currency: string;
  /** false for a role without the money capability (the server leaves the amounts out) */
  withMoney: boolean;
}

/** The server's rows as they come; nothing is summed, netted or re-sorted in the browser. */
export function PortfolioTable({ rows, currency, withMoney }: PortfolioTableProps) {
  const { number } = useNumberFormat();
  return (
    <DataTable
      caption="Loss, cause, action and outcome by cause"
      columns={columnsOf(number, currency, withMoney)}
      scrollable
      rows={rows}
      getRowKey={(row) => row.key}
      empty={{ text: 'No investigation was opened in this window.' }}
      density="compact"
    />
  );
}
