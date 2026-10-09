import { useCallback, useState } from 'react';
import { usePeriodSummaries } from '@/api/v2/queries/period-overview';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import type { GridWorkflowState, PeriodSummaryView, RevisionSelector } from '@/api/v2/types/period-overview';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { VirtualList } from '@/features/ux-kit/virtual-list';
import { WORKFLOW_LABELS } from '../model/display';
import { GRID_COLUMNS, PeriodGridRow } from './period-grid-row';

export interface PeriodGridProps {
  unitId: string;
  from: string;
  to: string;
  timezone: string;
  selectedId: string | null;
  onSelect: (periodId: string | null) => void;
}

const STATES: GridWorkflowState[] = ['none', 'draft', 'in_review', 'stale', 'approved'];
const HEADERS = ['Period', 'Target', 'Actual', 'Gap', 'Attributed', 'Residual', 'Quality', 'Readiness', 'Workflow', 'Last run'];

/**
 * Period grid (plan 3.5 step 1): one virtualized row per production period of the plan's unit and window
 * with the server's plan-ledger figures; filters by workflow state and by shown revision (current /
 * approved) go to the server; the next keyset page loads when the end comes into view.
 */
export function PeriodGrid({ unitId, from, to, timezone, selectedId, onSelect }: PeriodGridProps) {
  const [workflow, setWorkflow] = useState<GridWorkflowState | ''>('');
  const [view, setView] = useState<RevisionSelector>('current');
  const list = usePeriodSummaries({ unitIds: [unitId], from, to, view, ...(workflow ? { workflowState: [workflow] } : {}) }, timezone);
  const rows = flattenPages(list.data?.pages);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const state = dataStateOf(list, { isEmpty: rows.length === 0 });
  return (
    <section className="space-y-2" data-testid="period-grid" aria-label="Production periods">
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="space-y-1">
          <span className="block text-xs text-muted-foreground">Workflow state</span>
          <select id="gridWorkflow" className="h-9 rounded-md border border-input bg-background px-2" value={workflow} onChange={(e) => setWorkflow(e.target.value as GridWorkflowState | '')}>
            <option value="">All</option>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {WORKFLOW_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-muted-foreground">Figures of</span>
          <select id="gridView" className="h-9 rounded-md border border-input bg-background px-2" value={view} onChange={(e) => setView(e.target.value as RevisionSelector)}>
            <option value="current">Current revision (draft / in review / published)</option>
            <option value="approved">Approved revision only</option>
          </select>
        </label>
        <span className="text-xs text-muted-foreground">Plan ledger; residual = gap − attributed (server).</span>
      </div>
      <div role="table" aria-label="Periods" className="rounded-md border">
        <div role="row" className={`${GRID_COLUMNS} border-b bg-muted/40 px-2 py-1 text-xs font-medium`}>
          {HEADERS.map((h) => (
            <span key={h} role="columnheader">
              {h}
            </span>
          ))}
        </div>
        <DataState state={state} error={list.error} onRetry={() => void list.refetch()} detail={state === 'empty' ? 'No production periods in the plan window (materialize the unit’s periods first).' : undefined}>
          <VirtualList
            items={rows}
            rowHeight={44}
            height={Math.min(440, Math.max(88, rows.length * 44))}
            getKey={(row: PeriodSummaryView) => row.periodId}
            onEndReached={loadMore}
            renderRow={(row: PeriodSummaryView) => (
              <PeriodGridRow row={row} timezone={timezone} selected={row.periodId === selectedId} onSelect={() => onSelect(row.periodId === selectedId ? null : row.periodId)} />
            )}
          />
        </DataState>
      </div>
    </section>
  );
}
