import type { OeeReportView, ReportGroupView } from '@/api/v2/types/reports';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { findKpi, kpiText, OEE_METRIC_LABELS } from '../model/display';

export interface OeeGroupTableProps {
  report: OeeReportView;
  groupTitle: string;
  /** display name of a group key (unit / product names, a formatted date — never a UUID) */
  labelOf: (key: string | null) => string;
  testId: string;
}

const metricLabel = (metric: string) => OEE_METRIC_LABELS[metric.replace('reconciled_', '')] ?? metric;

type OeeGroup = ReportGroupView;

function columnsOf(report: OeeReportView, groupTitle: string, labelOf: OeeGroupTableProps['labelOf']): Array<DataTableColumn<OeeGroup>> {
  const metrics = report.total.map((t) => t.metric);
  return [
    {
      id: 'group',
      header: groupTitle,
      nowrap: true,
      cell: (group) => (
        <span data-testid="oee-group" data-key={group.key ?? ''}>
          {labelOf(group.key)}
        </span>
      ),
    },
    ...metrics.map<DataTableColumn<OeeGroup>>((metric) => ({
      id: metric,
      header: metricLabel(metric),
      align: 'right',
      cell: (group) => {
        const view = findKpi(group.metrics, metric);
        return (
          <span data-metric={metric} data-value={view?.value ?? ''}>
            {kpiText(view)}
          </span>
        );
      },
    })),
  ];
}

/** OEE components per server group (20 per page), each "Not available: <reason>" when the server has no value (T41). */
export function OeeGroupTable({ report, groupTitle, labelOf, testId }: OeeGroupTableProps) {
  return (
    <div data-testid={testId}>
      <DataTable
        caption={`${report.label} by ${groupTitle.toLowerCase()}`}
        columns={columnsOf(report, groupTitle, labelOf)}
        rows={report.groups}
        getRowKey={(group) => group.key ?? '-'}
        empty={{ text: 'No groups in this scope.' }}
        density="compact"
      />
    </div>
  );
}
