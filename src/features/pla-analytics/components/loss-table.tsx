import type { LossTreeGroupView, LossTreeMetric, LossTreeTotalView } from '@/api/v2/types/pla-analytics';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { amountText, shareText } from '../model/display';

export interface LossTableProps {
  groups: readonly LossTreeGroupView[];
  total: LossTreeTotalView | undefined;
  metric: LossTreeMetric;
  groupTitle: string;
  testId: string;
}

const groupLabel = (group: LossTreeGroupView) => group.label ?? (group.key ? 'Unknown code' : 'Not coded');

function columnsOf(metric: LossTreeMetric, groupTitle: string): Array<DataTableColumn<LossTreeGroupView>> {
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
          {amountText(group, metric)}
          {group.status === 'mixed' && (
            <Badge variant="secondary" className="ml-1">
              partly valued
            </Badge>
          )}
        </>
      ),
    },
    { id: 'share', header: 'Share', align: 'right', nowrap: true, cell: (group) => shareText(group.share) },
    { id: 'cumulative', header: 'Cumulative', align: 'right', nowrap: true, cell: (group) => shareText(group.cumulativeShare) },
    { id: 'lines', header: 'Lines', align: 'right', cell: (group) => group.lines },
  ];
}

/** Pareto table of server groups (20 per page): amount, share and the cumulative share; unvalued rows say why. */
export function LossTable({ groups, total, metric, groupTitle, testId }: LossTableProps) {
  return (
    <div className="space-y-2" data-testid={testId}>
      <DataTable
        caption={`${groupTitle} losses`}
        columns={columnsOf(metric, groupTitle)}
        rows={groups}
        getRowKey={(group) => `${group.key ?? '-'}|${group.unit ?? '-'}`}
        empty={{ text: 'No loss lines in this scope.' }}
        density="compact"
      />
      {total && (
        <p className="text-sm font-medium" data-testid="loss-total" data-amount={total.amount ?? ''} data-unit={total.unit ?? ''}>
          Total ({total.groups} groups, {total.lines} lines): {amountText(total, metric)}
        </p>
      )}
    </div>
  );
}
