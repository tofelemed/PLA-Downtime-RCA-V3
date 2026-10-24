import { useRestatements } from '@/api/v2/queries/ops-reports';
import type { RestatementRowView } from '@/api/v2/types/ops-reports';
import type { PostingTreatment } from '@/api/v2/types/restatement';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { ReportCard } from '@/features/pla-analytics/components/report-card';
import { scopeBase, type AnalyticsScope } from '@/features/pla-analytics/model/analytics-scope';
import { POSTING_TREATMENT_OPTIONS } from '@/features/plan-dashboard/model/restatement-labels';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { NumberText } from '@/features/ux-kit/number-text';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';

const treatmentOf = (row: RestatementRowView) => (row.treatment ? (POSTING_TREATMENT_OPTIONS[row.treatment as PostingTreatment] ?? row.treatment) : 'Not decided yet');

function useColumns(): Array<DataTableColumn<RestatementRowView>> {
  const pref = useCalendarPreference();
  return [
    { id: 'period', header: 'Period', cell: (r) => <span data-testid="restatement-row">{`${r.unitName ?? '—'} · ${formatOperationalDate(r.localDate, pref)}${r.shiftName ? ` · ${r.shiftName}` : ''}`}</span> },
    { id: 'revision', header: 'Revision', align: 'right', cell: (r) => <NumberText value={r.revision} /> },
    { id: 'afterClose', header: 'After close', cell: (r) => (r.afterClose ? 'Yes' : 'No') },
    { id: 'before', header: 'Good before', align: 'right', nowrap: true, cell: (r) => <NumberText value={r.goodBefore} fractionDigits={1} /> },
    { id: 'after', header: 'Good after', align: 'right', nowrap: true, cell: (r) => <NumberText value={r.goodAfter} fractionDigits={1} /> },
    { id: 'delta', header: 'Change', align: 'right', nowrap: true, cell: (r) => <NumberText value={r.goodDelta} fractionDigits={1} /> },
    { id: 'treatment', header: 'Posting', cell: (r) => (r.postingDate ? `${treatmentOf(r)} · ${formatOperationalDate(r.postingDate, pref)}` : treatmentOf(r)) },
  ];
}

/** Restatements of the month's periods (R3): what changed after approval and how finance posts it. */
export function RestatementsCard({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useRestatements(scopeBase(scope), env.timezone);
  const columns = useColumns();
  const rows = query.data?.rows ?? [];
  const state = dataStateOf(query, { isEmpty: query.data !== undefined && rows.length === 0 });
  return (
    <ReportCard title="Restatements" testId="statement-restatements">
      <DataState state={state} error={query.error} detail={state === 'empty' ? 'No period of this month was restated after approval.' : undefined} onRetry={() => void query.refetch()}>
        <div className="space-y-2">
          <DataTable caption="Restatements" columns={columns} rows={rows} getRowKey={(r) => `${r.periodId}-${r.revision}`} density="compact" />
          {query.data?.truncated && <p className="text-xs text-muted-foreground">Showing the 200 latest restatements.</p>}
        </div>
      </DataState>
    </ReportCard>
  );
}
