import type { PeriodSummaryView } from '@/api/v2/types/period-overview';
import type { DataTableColumn } from '@/features/ux-kit/data-table';
import { formatDecimal } from '@/features/ux-kit/format/decimal';
import { GRID_WORKFLOW_TONES, labelOf, READINESS_LABELS } from '@/features/ux-kit/labels';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import { toneOf } from '@/features/ux-kit/status-tone';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { type CalendarPreference, type DigitSystem, formatOperationalDate } from '@/lib/dates';
import { BLOCKING_RESIDUALS, formatRatioPercent, QUALITY_LABELS, RESIDUAL_LABELS, WORKFLOW_LABELS } from '../model/display';
import { SLA_STAGE_LABELS } from '../model/sla-labels';
import { SlaBadges } from '../sla/sla-badges';

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
        <PlantTime iso={row.utcStart} tz={timezone} stacked />
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

/** Due time of the current stage with the server's overdue / waiting / escalation verdicts (SME R3 / R6). */
function DueCell({ row, timezone }: { row: PeriodSummaryView; timezone: string }) {
  const sla = row.sla;
  if (!sla) return <span>—</span>;
  return (
    <span data-testid="cell-due" data-stage={sla.stage} data-overdue={sla.overdue}>
      <span className="block text-xs">{SLA_STAGE_LABELS[sla.stage]}</span>
      {sla.dueAt && sla.stage !== 'waiting_for_data' && <PlantTime iso={sla.dueAt} tz={timezone} withDate stacked />}
      <SlaBadges sla={sla} />
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
    { id: 'residual', header: 'Unaccounted', align: 'right', nowrap: true, cell: (row) => <ResidualCell row={row} digits={pref.digits} /> },
    { id: 'quality', header: 'Data quality', cell: (row) => <span className="text-xs">{row.qualityStates.map((q) => labelOf(QUALITY_LABELS, q)).join(', ') || '—'}</span> },
    { id: 'readiness', header: 'Inputs', cell: (row) => <span className="text-xs">{labelOf(READINESS_LABELS, row.stateReadiness)}</span> },
    {
      id: 'workflow',
      header: 'Workflow',
      cell: (row) => <StatusBadge tone={toneOf(GRID_WORKFLOW_TONES, row.workflowState)}>{WORKFLOW_LABELS[row.workflowState]}</StatusBadge>,
    },
    { id: 'due', header: 'Due', nowrap: true, cell: (row) => <DueCell row={row} timezone={timezone} /> },
    {
      id: 'calculated',
      header: 'Calculated',
      nowrap: true,
      cell: (row) => (row.run ? <span className="text-xs"><PlantTime iso={row.run.completedAt ?? row.run.startedAt} tz={timezone} withDate stacked /></span> : 'not yet'),
    },
  ];
}
