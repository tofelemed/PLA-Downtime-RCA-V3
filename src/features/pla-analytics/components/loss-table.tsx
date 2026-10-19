import { Link, type To } from 'react-router-dom';
import type { LossTreeGroupView, LossTreeMetric, LossTreeTotalView } from '@/api/v2/types/pla-analytics';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { plural } from '@/features/ux-kit/format/plural';
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
  /** why a row without a link has none (e.g. manual lines with no event), shown on the row */
  noLinkReason?: (group: LossTreeGroupView) => string | null;
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

function GroupLabel({ group, to, reason }: { group: LossTreeGroupView; to: To | null; reason: string | null }) {
  const testProps = { 'data-testid': 'loss-group', 'data-key': group.key ?? '', 'data-amount': group.amount ?? '', 'data-cumulative': group.cumulativeShare ?? '' };
  if (!to) {
    return (
      <span {...testProps}>
        {groupLabel(group)}
        {reason && <span className="block text-xs text-muted-foreground" data-testid="loss-group-no-link">{reason}</span>}
      </span>
    );
  }
  return <Link to={to} className="font-medium text-primary underline underline-offset-4" title="Show the records behind this row" {...testProps}>{groupLabel(group)}</Link>;
}

type Links = Pick<LossTableProps, 'rowLink' | 'noLinkReason'>;

function columnsOf(metric: LossTreeMetric, groupTitle: string, format: NumberFormat, links: Links): Array<DataTableColumn<LossTreeGroupView>> {
  const { digits } = format;
  return [
    {
      id: 'group',
      header: groupTitle,
      cell: (group) => {
        const to = links.rowLink?.(group) ?? null;
        return <GroupLabel group={group} to={to} reason={to ? null : (links.noLinkReason?.(group) ?? null)} />;
      },
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
export function LossTable({ groups, total, metric, groupTitle, testId, rowLink, noLinkReason }: LossTableProps) {
  const format = useNumberFormat();
  return (
    <div className="space-y-2" data-testid={testId}>
      <DataTable
        caption={`${groupTitle} losses`}
        columns={columnsOf(metric, groupTitle, format, { rowLink, noLinkReason })}
        rows={groups}
        getRowKey={(group) => `${group.key ?? '-'}|${group.unit ?? '-'}`}
        empty={{ text: 'No loss lines in this scope.' }}
        density="compact"
      />
      {total && (
        <p className="text-sm font-medium" data-testid="loss-total" data-amount={total.amount ?? ''} data-unit={total.unit ?? ''}>
          Total ({plural(total.groups, 'group', 'groups', format.number)}, {plural(total.lines, 'line', 'lines', format.number)}): {amountText(total, metric, format.digits)}
          <ProvisionalFxBadge show={total.fxProvisional} />
        </p>
      )}
    </div>
  );
}
