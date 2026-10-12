import { useState } from 'react';
import type { GridWorkflowState, PeriodSummaryView, RevisionSelector } from '@/api/v2/types/period-overview';
import { DataTable } from '@/features/ux-kit/data-table';
import { useCalendarPreference } from '@/lib/dates';
import { usePeriodGrid } from '../hooks/use-period-grid';
import { WORKFLOW_LABELS } from '../model/display';
import { periodGridColumns } from './period-grid-columns';

export interface PeriodGridProps {
  unitId: string;
  from: string;
  to: string;
  timezone: string;
  onOpen: (period: PeriodSummaryView) => void;
}

const STATES: GridWorkflowState[] = ['none', 'draft', 'in_review', 'stale', 'approved'];
const SELECT = 'h-9 rounded-md border border-input bg-background px-2';

/**
 * Period grid: one row per production period of the plan's unit and window with the server's plan-ledger
 * figures, 20 per page; filters by workflow state and shown revision go to the server. A row opens the
 * period's accounting workspace.
 */
export function PeriodGrid({ unitId, from, to, timezone, onOpen }: PeriodGridProps) {
  const pref = useCalendarPreference();
  const [workflow, setWorkflow] = useState<GridWorkflowState | ''>('');
  const [view, setView] = useState<RevisionSelector>('current');
  const grid = usePeriodGrid({ unitId, from, to, workflow, view });
  return (
    <section className="space-y-3" data-testid="period-grid" aria-label="Production periods">
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="space-y-1">
          <span className="block text-xs text-muted-foreground">Workflow state</span>
          <select id="gridWorkflow" className={SELECT} value={workflow} onChange={(e) => setWorkflow(e.target.value as GridWorkflowState | '')}>
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
          <select id="gridView" className={SELECT} value={view} onChange={(e) => setView(e.target.value as RevisionSelector)}>
            <option value="current">Current revision (draft, in review or approved)</option>
            <option value="approved">Approved revision only</option>
          </select>
        </label>
        <span className="text-xs text-muted-foreground">Plan ledger. Attributed = losses explained by loss lines; residual = gap − attributed (calculated by the server).</span>
      </div>
      <DataTable
        caption="Production periods"
        columns={periodGridColumns(timezone, pref)}
        rows={grid.rows}
        getRowKey={(row) => row.periodId}
        pager={grid.pager}
        status={grid.status}
        density="compact"
        empty={{ title: 'No periods', text: 'No production periods in the plan window yet: generate and approve the plan first.' }}
        onRowClick={onOpen}
        rowLabel={(row) => `Open period ${row.localDate}${row.shiftName ? ` ${row.shiftName}` : ''}`}
      />
    </section>
  );
}
