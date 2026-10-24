import type { OeeReportView, ReportGroupView } from '@/api/v2/types/reports';
import { type DigitSystem, useCalendarPreference } from '@/lib/dates';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { anyProvisional, ProvisionalMark } from '@/features/ux-kit/report-look';
import { NoPlanLink } from '@/features/month-close/components/no-plan-notice';
import { findKpi, inSentence, kpiText, OEE_METRIC_LABELS } from '../model/display';
import { oeeColumnOrder } from '../model/oee-column-order';
import { oeeRowNote, rowHasNoFigures, type OeeRowNote } from '../model/oee-row-note';
import { useReportChrome } from './use-report-chrome';

export interface OeeGroupTableProps {
  report: OeeReportView;
  groupTitle: string;
  /** display name of a group key (unit / product names, a formatted date — never a UUID) */
  labelOf: (key: string | null) => string;
  testId: string;
  /** the table's accessible caption (default: "<policy label> by <group>") */
  caption?: string;
}

const metricLabel = (metric: string) => OEE_METRIC_LABELS[metric.replace('reconciled_', '')] ?? metric;

type OeeGroup = ReportGroupView;

function RowNote({ note }: { note: OeeRowNote }) {
  if (!note) return null;
  return <span className="block whitespace-normal text-xs" data-testid="oee-row-note">{note.kind === 'no-plan' ? <NoPlanLink /> : <span className="text-muted-foreground">{note.text}</span>}</span>;
}

interface ColumnsInput {
  metrics: readonly string[];
  groupTitle: string;
  labelOf: OeeGroupTableProps['labelOf'];
  digits: DigitSystem;
}

function columnsOf({ metrics, groupTitle, labelOf, digits }: ColumnsInput): Array<DataTableColumn<OeeGroup>> {
  return [
    {
      id: 'group',
      header: groupTitle,
      nowrap: true,
      cell: (group) => (
        <span data-testid="oee-group" data-key={group.key ?? ''}>
          {labelOf(group.key)}
          <ProvisionalMark when={anyProvisional(group.metrics)} />
          <RowNote note={oeeRowNote(group, metrics, digits)} />
        </span>
      ),
    },
    ...metrics.map<DataTableColumn<OeeGroup>>((metric) => ({
      id: metric,
      header: metricLabel(metric),
      align: 'right',
      cell: (group) => {
        const view = findKpi(group.metrics, metric);
        const said = oeeRowNote(group, metrics, digits) !== null && rowHasNoFigures(group, metrics);
        return (
          <span data-metric={metric} data-value={view?.value ?? ''}>
            {said ? <span aria-label="No figure (see the row note)">—</span> : kpiText(view, digits)}
          </span>
        );
      },
    })),
  ];
}

/**
 * OEE components per server group (20 per page): "Not available: <reason>" when the server has no value (T41),
 * said once per row when the whole row shares it or no approved plan covers the row (QA re-test N4). On the
 * Reports page the columns read OEE, Availability, Performance, Quality and, with Revision = Provisional, a
 * row the server marks provisional says so.
 */
export function OeeGroupTable({ report, groupTitle, labelOf, testId, caption }: OeeGroupTableProps) {
  const { digits } = useCalendarPreference();
  const onReports = useReportChrome();
  const serverOrder = report.total.map((t) => t.metric);
  const metrics = onReports ? oeeColumnOrder(serverOrder) : serverOrder;
  return (
    <div data-testid={testId}>
      <DataTable
        caption={caption ?? `${report.label} by ${inSentence(groupTitle)}`}
        columns={columnsOf({ metrics, groupTitle, labelOf, digits })}
        rows={report.groups}
        getRowKey={(group) => group.key ?? '-'}
        empty={{ text: 'No groups in this scope.' }}
        density="compact"
      />
    </div>
  );
}
