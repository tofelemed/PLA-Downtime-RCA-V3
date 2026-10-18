import { Link, type To } from 'react-router-dom';
import type { LossTreeGroupView, LossTreeMetric, LossTreeTotalView } from '@/api/v2/types/pla-analytics';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { type NumberFormat, useNumberFormat } from '@/features/ux-kit/use-number-format';
import { amountText, shareText } from '../model/display';

export interface LossTableProps {
  groups: readonly LossTreeGroupView[];
  total: LossTreeTotalView | undefined;
  metric: LossTreeMetric;
  groupTitle: string;
  testId: string;
  /** drill-down of a row (events of its reason, unit or OEE component); null = no link for that row */
  rowLink?: (group: LossTreeGroupView) => To | null;
}

/** SME V7: the amount rests on a provisional exchange rate (said in words, revalued with the final rate). */
function ProvisionalFxBadge({ show }: { show: boolean | undefined }) {
  if (!show) return null;
  return (
    <Badge variant="outline" className="ml-1" data-testid="fx-provisional-mark" title="Converted with a provisional exchange rate; revalued when the final rate is approved">
      provisional rate
    </Badge>
  );
}

const groupLabel = (group: LossTreeGroupView) => group.label ?? (group.key ? 'Unknown code' : 'Not coded');

function GroupLabel({ group, to }: { group: LossTreeGroupView; to: To | null }) {
  const testProps = { 'data-testid': 'loss-group', 'data-key': group.key ?? '', 'data-amount': group.amount ?? '', 'data-cumulative': group.cumulativeShare ?? '' };
  if (!to) return <span {...testProps}>{groupLabel(group)}</span>;
  return <Link to={to} className="font-medium text-primary underline underline-offset-4" title="Show the events behind this row" {...testProps}>{groupLabel(group)}</Link>;
}

function columnsOf(metric: LossTreeMetric, groupTitle: string, format: NumberFormat, rowLink?: LossTableProps['rowLink']): Array<DataTableColumn<LossTreeGroupView>> {
  const { digits } = format;
  return [
    {
      id: 'group',
      header: groupTitle,
      cell: (group) => <GroupLabel group={group} to={rowLink?.(group) ?? null} />,
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'right',
      nowrap: true,
      cell: (group) => (
        <>
          {amountText(group, metric, digits)}
          {group.status === 'mixed' && (
            <Badge variant="secondary" className="ml-1">
              partly valued
            </Badge>
          )}
          <ProvisionalFxBadge show={group.fxProvisional} />
        </>
      ),
    },
    { id: 'share', header: 'Share', align: 'right', nowrap: true, cell: (group) => shareText(group.share, digits) },
    { id: 'cumulative', header: 'Cumulative', align: 'right', nowrap: true, cell: (group) => shareText(group.cumulativeShare, digits) },
    { id: 'lines', header: 'Lines', align: 'right', cell: (group) => format.number(group.lines) },
  ];
}

/** Pareto table of server groups (20 per page): amount, share and the cumulative share; unvalued rows say why. */
export function LossTable({ groups, total, metric, groupTitle, testId, rowLink }: LossTableProps) {
  const format = useNumberFormat();
  return (
    <div className="space-y-2" data-testid={testId}>
      <DataTable
        caption={`${groupTitle} losses`}
        columns={columnsOf(metric, groupTitle, format, rowLink)}
        rows={groups}
        getRowKey={(group) => `${group.key ?? '-'}|${group.unit ?? '-'}`}
        empty={{ text: 'No loss lines in this scope.' }}
        density="compact"
      />
      {total && (
        <p className="text-sm font-medium" data-testid="loss-total" data-amount={total.amount ?? ''} data-unit={total.unit ?? ''}>
          Total ({format.number(total.groups)} groups, {format.number(total.lines)} lines): {amountText(total, metric, format.digits)}
          <ProvisionalFxBadge show={total.fxProvisional} />
        </p>
      )}
    </div>
  );
}
