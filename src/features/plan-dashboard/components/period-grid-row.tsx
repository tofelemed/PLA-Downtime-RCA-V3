import { Badge } from '@/components/ui/badge';
import type { PeriodSummaryView } from '@/api/v2/types/period-overview';
import { formatDecimal } from '@/features/ux-kit/format/decimal';
import { formatPlantTime } from '@/features/ux-kit/format/plant-time';
import { BLOCKING_RESIDUALS, formatRatioPercent, READINESS_LABELS, RESIDUAL_LABELS, WORKFLOW_LABELS } from '../model/display';

export const GRID_COLUMNS = 'grid grid-cols-[1.6fr_repeat(5,1fr)_1fr_0.8fr_1fr_1fr] gap-2 items-center';

export interface PeriodGridRowProps {
  row: PeriodSummaryView;
  timezone: string;
  selected: boolean;
  onSelect: () => void;
}

const num = (value: string | null | undefined, uom: string | null | undefined) =>
  value === null || value === undefined ? '—' : `${formatDecimal(value)}${uom ? ` ${uom}` : ''}`;

const coverageText = (ratio: string | null) => (ratio === null ? 'no actuals' : `${formatRatioPercent(ratio)} covered`);

/** One period: server figures with units, residual state as text and colour, readiness ≠ workflow (WF01). */
export function PeriodGridRow({ row, timezone, selected, onSelect }: PeriodGridRowProps) {
  const plan = row.plan;
  const residualState = plan?.residualState ?? 'not_computable';
  const blocking = BLOCKING_RESIDUALS.has(residualState);
  return (
    <div
      role="row"
      tabIndex={0}
      aria-selected={selected}
      data-testid="period-row"
      data-period-id={row.periodId}
      data-residual-state={residualState}
      data-workflow={row.workflowState}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className={`${GRID_COLUMNS} cursor-pointer border-b px-2 py-2 text-sm hover:bg-muted/40 ${selected ? 'bg-muted' : ''}`}
    >
      <span role="cell">
        {row.localDate} {row.shiftName ? `· ${row.shiftName}` : ''}
        <span className="block text-xs text-muted-foreground">{formatPlantTime(row.utcStart, timezone)}</span>
      </span>
      <span role="cell" data-testid="cell-target">{num(plan?.target, plan?.uom)}</span>
      <span role="cell" data-testid="cell-actual">
        {num(plan?.actual, plan?.uom)}
        <span className="block text-xs text-muted-foreground">{coverageText(row.coverageRatio)}</span>
      </span>
      <span role="cell" data-testid="cell-gap">{num(plan?.gap, plan?.uom)}</span>
      <span role="cell" data-testid="cell-attributed">{num(plan?.attributed, plan?.uom)}</span>
      <span role="cell" data-testid="cell-residual" className={blocking ? 'font-medium text-destructive' : undefined}>
        {num(plan?.residual, plan?.uom)}
        <span className="block text-xs">{RESIDUAL_LABELS[residualState]}</span>
      </span>
      <span role="cell" className="text-xs">{row.qualityStates.join(', ') || '—'}</span>
      <span role="cell" className="text-xs">{READINESS_LABELS[row.stateReadiness] ?? row.stateReadiness}</span>
      <span role="cell">
        <Badge variant={row.workflowState === 'approved' ? 'default' : row.workflowState === 'stale' ? 'destructive' : 'secondary'}>{WORKFLOW_LABELS[row.workflowState]}</Badge>
      </span>
      <span role="cell" className="text-xs">{row.run ? formatPlantTime(row.run.completedAt ?? row.run.startedAt, timezone, true) : 'no run'}</span>
    </div>
  );
}
