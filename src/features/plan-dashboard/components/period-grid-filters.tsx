import type { GridWorkflowState, RevisionSelector } from '@/api/v2/types/period-overview';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/features/ux-kit/date-inputs';
import { dateToText } from '@/features/ux-kit/date-inputs/date-input-model';
import { useCalendarPreference } from '@/lib/dates';
import { WORKFLOW_LABELS } from '../model/display';
import { GRID_STATES, outsidePlanMessage, RESIDUAL_FILTERS, type GridParamKey, type GridParams } from '../model/period-grid-params';

export interface PeriodGridFiltersProps {
  params: GridParams;
  onParam: (key: GridParamKey, value: string) => void;
  view: RevisionSelector;
  onView: (view: RevisionSelector) => void;
  /** inclusive plant dates of the plan window */
  bounds: { min: string; max: string };
}

const SELECT = 'h-9 max-w-full rounded-md border border-input bg-background px-2';

/** Server filters of the period grid: workflow state, Unaccounted, shown revision and "Go to date" (a plant date in the plan). */
export function PeriodGridFilters({ params, onParam, view, onView, bounds }: PeriodGridFiltersProps) {
  const { calendar } = useCalendarPreference();
  const outside = outsidePlanMessage(params.date, bounds, (date) => dateToText(date, calendar));
  return (
    <div className="flex flex-wrap items-end gap-3 text-sm">
      <label className="min-w-0 max-w-full space-y-1">
        <span className="block text-xs text-muted-foreground">Workflow state</span>
        <select id="gridWorkflow" className={SELECT} value={params.workflow} onChange={(e) => onParam('state', e.target.value as GridWorkflowState | '')}>
          <option value="">All</option>
          {GRID_STATES.map((s) => (
            <option key={s} value={s}>
              {WORKFLOW_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="min-w-0 max-w-full space-y-1">
        <span className="block text-xs text-muted-foreground">Unaccounted</span>
        <select id="gridResidual" data-testid="grid-residual" className={SELECT} value={params.residual} onChange={(e) => onParam('residual', e.target.value)}>
          <option value="">All periods</option>
          {Object.entries(RESIDUAL_FILTERS).map(([key, filter]) => (
            <option key={key} value={key}>
              {filter.label}
            </option>
          ))}
        </select>
      </label>
      <label className="min-w-0 max-w-full space-y-1">
        <span className="block text-xs text-muted-foreground">Figures of</span>
        <select id="gridView" className={SELECT} value={view} onChange={(e) => onView(e.target.value as RevisionSelector)}>
          <option value="current">Current revision (draft, in review or approved)</option>
          <option value="approved">Approved revision only</option>
        </select>
      </label>
      <div className="flex items-end gap-1" data-testid="grid-go-to-date">
        <DateInput id="gridDate" label="Go to date" value={params.date} min={bounds.min || undefined} max={bounds.max || undefined} onChange={(date) => onParam('date', date)} />
        {params.date && (
          <Button type="button" variant="ghost" size="sm" data-testid="grid-date-clear" onClick={() => onParam('date', '')}>
            From plan start
          </Button>
        )}
      </div>
      {outside && (
        <p role="status" className="basis-full text-xs text-muted-foreground" data-testid="grid-date-outside">
          {outside}
        </p>
      )}
    </div>
  );
}
