import type { LossTreeGroupView, LossTreeMetric, LossTreeTotalView } from '@/api/v2/types/pla-analytics';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { amountText, shareText } from '../model/display';

export interface LossTableProps {
  groups: readonly LossTreeGroupView[];
  total: LossTreeTotalView | undefined;
  metric: LossTreeMetric;
  groupTitle: string;
  testId: string;
}

/** Pareto table of server groups: amount, share and the cumulative share line; unvalued rows say why. */
export function LossTable({ groups, total, metric, groupTitle, testId }: LossTableProps) {
  return (
    <Table data-testid={testId} aria-label={`${groupTitle} losses`}>
      <TableHeader>
        <TableRow>
          <TableHead>{groupTitle}</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="text-right">Share</TableHead>
          <TableHead className="text-right">Cumulative</TableHead>
          <TableHead className="text-right">Lines</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => (
          <TableRow key={`${group.key ?? '-'}|${group.unit ?? '-'}`} data-testid="loss-group" data-key={group.key ?? ''} data-amount={group.amount ?? ''} data-cumulative={group.cumulativeShare ?? ''}>
            <TableCell>{group.label ?? (group.key ? 'Unknown code' : 'Not coded')}</TableCell>
            <TableCell className="text-right">
              {amountText(group, metric)}
              {group.status === 'mixed' && (
                <Badge variant="secondary" className="ml-1">
                  partly valued
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-right">{shareText(group.share)}</TableCell>
            <TableCell className="text-right">{shareText(group.cumulativeShare)}</TableCell>
            <TableCell className="text-right">{group.lines}</TableCell>
          </TableRow>
        ))}
        {total && (
          <TableRow className="font-medium" data-testid="loss-total" data-amount={total.amount ?? ''} data-unit={total.unit ?? ''}>
            <TableCell>Total ({total.groups} groups)</TableCell>
            <TableCell className="text-right">{amountText(total, metric)}</TableCell>
            <TableCell />
            <TableCell />
            <TableCell className="text-right">{total.lines}</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
