import { useSearchParams } from 'react-router-dom';
import { usePeriodSummaryList } from '@/api/v2/queries/period-summaries';
import type { PeriodSummaryView } from '@/api/v2/types/period-overview';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { DataTable } from '@/features/ux-kit/data-table';
import { ReportLookContext } from '@/features/ux-kit/report-look';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { usePeriodGrid, type PeriodGridQuery } from '../hooks/use-period-grid';
import { gridWindow, parseGridParams, planDateBounds, residualStatesOf, withGridParam, type GridParamKey, type ResidualFilter } from '../model/period-grid-params';
import { useLossAccountingMode } from '@/features/accounting-mode/use-loss-accounting-mode';
import { periodGridColumns, type GridMode } from './period-grid-columns';
import { gridNote } from '../model/grid-notes';
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
  mode: GridMode;
  onOpen: (period: PeriodSummaryView) => void;
}

/** The shared report table look; the grid shows the plan ledger, never provisional figures. */
const GRID_LOOK = { provisional: false } as const;

type ListState = Pick<ReturnType<typeof usePeriodGrid>, 'rows' | 'pager' | 'status'>;

function GridTable({ list, timezone, filtered, onOpen, mode }: { list: ListState; mode: GridMode } & Pick<TableProps, 'timezone' | 'filtered' | 'onOpen'>) {
  const pref = useCalendarPreference();
  return (
    <DataTable
      caption="Production periods"
      columns={periodGridColumns(timezone, pref, mode)}
      rows={list.rows}
      getRowKey={(row) => row.periodId}
      pager={list.pager}
      status={list.status}
      density="compact"
      empty={{ title: 'No periods', text: filtered ? 'No production periods match these filters.' : 'No production periods in the plan window yet: generate and approve the plan first.' }}
      onRowClick={onOpen}
      rowLabel={(row) => `Open period ${formatOperationalDate(row.localDate, pref)}${!mode.isDay && row.shiftName ? ` ${row.shiftName}` : ''}`}
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
 * (`state`, `residual`, `date`, `view`), so a filtered grid can be linked. A row opens the period's workspace.
 */
function PeriodGridCard({ unitId, from, to, timezone, onOpen }: PeriodGridProps) {
  const [search, setSearch] = useSearchParams();
  const params = parseGridParams(search);
  const { view } = params;
  const plan = { from, to };
  const window = gridWindow(plan, params.date, timezone);
  const query: PeriodGridQuery = { unitId, from: window.from, to: window.to, workflow: params.workflow, view };
  const onParam = (key: GridParamKey, value: string) => setSearch((current) => withGridParam(current, key, value), { replace: true });
  const filtered = Boolean(params.workflow || params.date || params.residual);
  const { isDay, isDeclared } = useLossAccountingMode(unitId);
  const mode: GridMode = { isDay, isDeclared };
  return (
    <section className="min-w-0 space-y-3 rounded-lg border bg-card p-4" data-testid="period-grid" aria-labelledby="period-grid-title" data-window-from={window.from}>
      <h2 id="period-grid-title" className="flex items-center gap-1.5 text-base font-semibold text-heading">
        Production periods <KpiInfo label="Production periods" text={gridNote(mode)} />
      </h2>
      <PeriodGridFilters params={params} onParam={onParam} view={view} onView={(next) => onParam('view', next === 'approved' ? 'approved' : '')} bounds={planDateBounds(plan, timezone)} />
      {params.residual ? (
        <ResidualTable query={query} residual={params.residual} timezone={timezone} filtered mode={mode} onOpen={onOpen} />
      ) : (
        <PagedTable query={query} timezone={timezone} filtered={filtered} mode={mode} onOpen={onOpen} />
      )}
    </section>
  );
}

/** The period list card of `/plans/:planId`: compact report-look table with its server filters. */
export function PeriodGrid(props: PeriodGridProps) {
  return (
    <ReportLookContext.Provider value={GRID_LOOK}>
      <PeriodGridCard {...props} />
    </ReportLookContext.Provider>
  );
}
