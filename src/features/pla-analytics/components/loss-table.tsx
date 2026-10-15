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

function columnsOf(metric: LossTreeMetric, groupTitle: string, format: NumberFormat): Array<DataTableColumn<LossTreeGroupView>> {
  const { digits } = format;
  return [
    {
      id: 'group',
      header: groupTitle,
      cell: (group) => (
        <span data-testid="loss-group" data-key={group.key ?? ''} data-amount={group.amount ?? ''} data-cumulative={group.cumulativeShare ?? ''}>
          {groupLabel(group)}
        </span>
      ),
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
export function LossTable({ groups, total, metric, groupTitle, testId }: LossTableProps) {
  const format = useNumberFormat();
  return (
    <div className="space-y-2" data-testid={testId}>
      <DataTable
        caption={`${groupTitle} losses`}
        columns={columnsOf(metric, groupTitle, format)}
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
