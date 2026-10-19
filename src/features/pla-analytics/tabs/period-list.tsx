import { Link, useSearchParams } from 'react-router-dom';
import { usePeriodSummaryList } from '@/api/v2/queries/period-summaries';
import type { PeriodSummaryView } from '@/api/v2/types/period-overview';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { GRID_WORKFLOW_LABELS, RESIDUAL_LABELS } from '@/features/ux-kit/labels';
import { useCalendarPreference } from '@/lib/dates';
import { periodLabel } from '../model/period-label';
import type { AnalyticsScope } from '../model/analytics-scope';
import { periodListQuery, periodListTitle, periodRowHref, withPeriodList, type PeriodListFilter } from '../model/period-list';

function useColumns(filter: PeriodListFilter): Array<DataTableColumn<PeriodSummaryView>> {
  const env = useEventHubEnv();
  const pref = useCalendarPreference();
  return [
    { id: 'unit', header: 'Unit', cell: (row) => env.unitName(row.unitId) },
    {
      id: 'period',
      header: 'Period',
      nowrap: true,
      cell: (row) => (
        <span data-testid="period-list-row" data-period-id={row.periodId}>
          {periodLabel(row, env.timezone, pref)}
        </span>
      ),
    },
    { id: 'state', header: 'State', cell: (row) => GRID_WORKFLOW_LABELS[row.workflowState] },
    { id: 'residual', header: 'Unaccounted', cell: (row) => (row.plan ? RESIDUAL_LABELS[row.plan.residualState] : '—') },
    {
      id: 'open',
      header: 'Period accounting',
      cell: (row) =>
        row.planId ? (
          <Link className="underline" to={periodRowHref(filter, row.planId, row.periodId)} data-testid="period-list-link" data-period-id={row.periodId}>
            {filter.kind === 'quality' ? 'Open dispositions' : 'Open'}
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">no plan</span>
        ),
    },
  ];
}

/**
 * UX D-6: the periods behind one reconciliation count — every plan of the analytics scope's units and window
 * in that workflow or residual state (current revision, newest first), each opening its period accounting.
 * The server filters; a residual-filtered page may be short, so the list keeps paging ("Show more").
 */
export function PeriodList({ scope, filter }: { scope: AnalyticsScope; filter: PeriodListFilter }) {
  const [search] = useSearchParams();
  const list = usePeriodSummaryList(periodListQuery(scope, filter), 'pla-period-list');
  const columns = useColumns(filter);
  const title = periodListTitle(filter);
  return (
    <section className="space-y-3 rounded-md border p-4" data-testid="pla-period-list" data-filter={filter.state} aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{title}</h3>
        <Link className="text-sm underline" to={withPeriodList(search, '')} data-testid="period-list-back">
          Back to the counts
        </Link>
      </div>
      <p className="text-xs text-muted-foreground">
        Current revision of each period in the {scope.windowLabel.toLowerCase()}, all plans of {scope.unitIds.length > 0 ? 'the selected units' : 'the whole plant'}.
        {filter.kind === 'quality' && ' Quality losses are recorded as lot dispositions on each period’s Actuals & quality, not as events.'}
      </p>
      <DataTable
        caption={title}
        columns={columns}
        rows={list.rows}
        getRowKey={(row) => row.periodId}
        pager={list.pager}
        status={list.status}
        density="compact"
        empty={{ text: 'No production periods in this state.' }}
      />
    </section>
  );
}
