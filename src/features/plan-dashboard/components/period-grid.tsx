import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePeriodSummaryList } from '@/api/v2/queries/period-summaries';
import type { PeriodSummaryView, RevisionSelector } from '@/api/v2/types/period-overview';
import { DataTable } from '@/features/ux-kit/data-table';
import { useCalendarPreference } from '@/lib/dates';
import { usePeriodGrid, type PeriodGridQuery } from '../hooks/use-period-grid';
import { gridWindow, parseGridParams, planDateBounds, residualStatesOf, withGridParam, type GridParamKey, type ResidualFilter } from '../model/period-grid-params';
import { periodGridColumns } from './period-grid-columns';
import { PeriodGridFilters } from './period-grid-filters';

export interface PeriodGridProps {
  unitId: string;
  from: string;
  to: string;
  timezone: string;
  onOpen: (period: PeriodSummaryView) => void;
}

interface TableProps {
  query: PeriodGridQuery;
  residual: ResidualFilter | '';
  timezone: string;
  filtered: boolean;
  onOpen: (period: PeriodSummaryView) => void;
}

type ListState = Pick<ReturnType<typeof usePeriodGrid>, 'rows' | 'pager' | 'status'>;

function GridTable({ list, timezone, filtered, onOpen }: { list: ListState } & Pick<TableProps, 'timezone' | 'filtered' | 'onOpen'>) {
  const pref = useCalendarPreference();
  return (
    <DataTable
      caption="Production periods"
      columns={periodGridColumns(timezone, pref)}
      rows={list.rows}
      getRowKey={(row) => row.periodId}
      pager={list.pager}
      status={list.status}
      density="compact"
      empty={{ title: 'No periods', text: filtered ? 'No production periods match these filters.' : 'No production periods in the plan window yet: generate and approve the plan first.' }}
      onRowClick={onOpen}
      rowLabel={(row) => `Open period ${row.localDate}${row.shiftName ? ` ${row.shiftName}` : ''}`}
    />
  );
}

/** Pages of 20 (one keyset page each). */
function PagedTable({ query, ...rest }: Omit<TableProps, 'residual'>) {
  return <GridTable list={usePeriodGrid(query)} {...rest} />;
}

/** Residual-filtered: a filtered server page may be short while more follow, so the list fills and grows ("Show more"). */
function ResidualTable({ query, residual, ...rest }: TableProps & { residual: ResidualFilter }) {
  const list = usePeriodSummaryList(
    { unitIds: [query.unitId], from: query.from, to: query.to, view: query.view, workflowState: query.workflow ? [query.workflow] : undefined, residualStates: residualStatesOf(residual) },
    'period-grid-residual',
  );
  return <GridTable list={list} {...rest} />;
}

/**
 * Period grid: one row per production period of the plan's unit and window with the server's plan-ledger
 * figures, 20 per page; filters by workflow state, Unaccounted (residual state) and shown revision go to the
 * server, and "Go to date" starts the server window at that plant date. The filters live in the URL
 * (`state`, `residual`, `date`), so a filtered grid can be linked. A row opens the period's workspace.
 */
export function PeriodGrid({ unitId, from, to, timezone, onOpen }: PeriodGridProps) {
  const [search, setSearch] = useSearchParams();
  const params = parseGridParams(search);
  const [view, setView] = useState<RevisionSelector>('current');
  const plan = { from, to };
  const window = gridWindow(plan, params.date, timezone);
  const query: PeriodGridQuery = { unitId, from: window.from, to: window.to, workflow: params.workflow, view };
  const onParam = (key: GridParamKey, value: string) => setSearch((current) => withGridParam(current, key, value), { replace: true });
  const filtered = Boolean(params.workflow || params.date || params.residual);
  return (
    <section className="space-y-3" data-testid="period-grid" aria-label="Production periods" data-window-from={window.from}>
      <PeriodGridFilters params={params} onParam={onParam} view={view} onView={setView} bounds={planDateBounds(plan, timezone)} />
      <p className="text-xs text-muted-foreground">Plan ledger. Attributed = losses explained by loss lines; Unaccounted = gap − attributed − tolerance adjustment (calculated by the server).</p>
      {params.residual ? (
        <ResidualTable query={query} residual={params.residual} timezone={timezone} filtered onOpen={onOpen} />
      ) : (
        <PagedTable query={query} timezone={timezone} filtered={filtered} onOpen={onOpen} />
      )}
    </section>
  );
}
