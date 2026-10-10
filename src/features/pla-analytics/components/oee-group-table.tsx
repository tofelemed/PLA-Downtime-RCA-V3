import type { OeeReportView } from '@/api/v2/types/reports';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { findKpi, kpiText } from '../model/display';

export interface OeeGroupTableProps {
  report: OeeReportView;
  groupTitle: string;
  /** display name of a group key (unit / product names from the reference lists, never a UUID) */
  labelOf: (key: string | null) => string;
  testId: string;
}

/** OEE components per server group, each "Not available: <reason>" when the server has no value (T41). */
export function OeeGroupTable({ report, groupTitle, labelOf, testId }: OeeGroupTableProps) {
  const metrics = report.total.map((t) => t.metric);
  return (
    <Table data-testid={testId} aria-label={`${report.label} by ${groupTitle}`}>
      <TableHeader>
        <TableRow>
          <TableHead>{groupTitle}</TableHead>
          {metrics.map((metric) => (
            <TableHead key={metric} className="text-right">
              {metric.replace('reconciled_', '').replace(/^\w/, (c) => c.toUpperCase())}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.groups.map((group) => (
          <TableRow key={group.key ?? '-'} data-testid="oee-group" data-key={group.key ?? ''}>
            <TableCell>{labelOf(group.key)}</TableCell>
            {metrics.map((metric) => {
              const view = findKpi(group.metrics, metric);
              return (
                <TableCell key={metric} className="text-right" data-metric={metric} data-value={view?.value ?? ''}>
                  {kpiText(view)}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
