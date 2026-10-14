import { Badge } from '@/components/ui/badge';
import type { PeriodSummaryView } from '@/api/v2/types/period-overview';
import type { DataTableColumn } from '@/features/ux-kit/data-table';
import { formatDecimal } from '@/features/ux-kit/format/decimal';
import { labelOf, READINESS_LABELS } from '@/features/ux-kit/labels';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { type CalendarPreference, type DigitSystem, formatOperationalDate } from '@/lib/dates';
import { BLOCKING_RESIDUALS, formatRatioPercent, QUALITY_LABELS, RESIDUAL_LABELS, WORKFLOW_LABELS } from '../model/display';

const num = (value: string | null | undefined, uom: string | null | undefined, digits: DigitSystem) =>
  value === null || value === undefined ? '—' : `${formatDecimal(value, 2, digits)}${uom ? ` ${uom}` : ''}`;

const coverageText = (ratio: string | null, digits: DigitSystem) => (ratio === null ? 'no actuals' : `${formatRatioPercent(ratio, digits)} covered`);

function PeriodCell({ row, timezone, pref }: { row: PeriodSummaryView; timezone: string; pref: CalendarPreference }) {
  const residualState = row.plan?.residualState ?? 'not_computable';
  return (
    <span data-testid="period-row" data-period-id={row.periodId} data-residual-state={residualState} data-workflow={row.workflowState}>
      {formatOperationalDate(row.localDate, pref)}
      {row.shiftName ? ` · ${row.shiftName}` : ''}
      <span className="block text-xs text-muted-foreground">
        <PlantTime iso={row.utcStart} tz={timezone} />
      </span>
    </span>
  );
}

function ResidualCell({ row, digits }: { row: PeriodSummaryView; digits: DigitSystem }) {
  const state = row.plan?.residualState ?? 'not_computable';
  return (
    <span data-testid="cell-residual" className={BLOCKING_RESIDUALS.has(state) ? 'font-medium text-destructive' : undefined}>
      {num(row.plan?.residual, row.plan?.uom, digits)}
      <span className="block text-xs">{RESIDUAL_LABELS[state]}</span>
    </span>
  );
}

/** Columns of the period grid: server figures with units, residual state in words, readiness ≠ workflow. */
export function periodGridColumns(timezone: string, pref: CalendarPreference): DataTableColumn<PeriodSummaryView>[] {
  return [
    { id: 'period', header: 'Period', nowrap: true, cell: (row) => <PeriodCell row={row} timezone={timezone} pref={pref} /> },
    { id: 'target', header: 'Target', align: 'right', nowrap: true, cell: (row) => <span data-testid="cell-target">{num(row.plan?.target, row.plan?.uom, pref.digits)}</span> },
    {
      id: 'actual',
      header: 'Actual',
      align: 'right',
      nowrap: true,
      cell: (row) => (
        <span data-testid="cell-actual">
          {num(row.plan?.actual, row.plan?.uom, pref.digits)}
          <span className="block text-xs text-muted-foreground">{coverageText(row.coverageRatio, pref.digits)}</span>
        </span>
      ),
    },
    { id: 'gap', header: 'Gap', align: 'right', nowrap: true, cell: (row) => <span data-testid="cell-gap">{num(row.plan?.gap, row.plan?.uom, pref.digits)}</span> },
    { id: 'attributed', header: 'Attributed', align: 'right', nowrap: true, cell: (row) => <span data-testid="cell-attributed">{num(row.plan?.attributed, row.plan?.uom, pref.digits)}</span> },
    { id: 'residual', header: 'Residual', align: 'right', nowrap: true, cell: (row) => <ResidualCell row={row} digits={pref.digits} /> },
    { id: 'quality', header: 'Data quality', cell: (row) => <span className="text-xs">{row.qualityStates.map((q) => labelOf(QUALITY_LABELS, q)).join(', ') || '—'}</span> },
    { id: 'readiness', header: 'Inputs', cell: (row) => <span className="text-xs">{labelOf(READINESS_LABELS, row.stateReadiness)}</span> },
    {
      id: 'workflow',
      header: 'Workflow',
      cell: (row) => <Badge variant={row.workflowState === 'approved' ? 'default' : row.workflowState === 'stale' ? 'destructive' : 'secondary'}>{WORKFLOW_LABELS[row.workflowState]}</Badge>,
    },
    {
      id: 'calculated',
      header: 'Calculated',
      nowrap: true,
      cell: (row) => (row.run ? <span className="text-xs"><PlantTime iso={row.run.completedAt ?? row.run.startedAt} tz={timezone} withDate /></span> : 'not yet'),
    },
  ];
}
