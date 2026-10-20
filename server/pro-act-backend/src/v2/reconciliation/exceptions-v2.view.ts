import { formatDec, toDec } from '../../domain/actuals/decimal';
import { ExceptionRow } from './exceptions-sql';
import { ExceptionType, ExceptionWorkflow } from './exceptions-v2.dto';

/** Where a row is fixed: a section of the period workspace, the period's stops, or a duplicate-stop review. */
export type ExceptionTarget =
  | {
      screen: 'period';
      planId: string;
      periodId: string;
      section: 'reconciliation' | 'actuals' | 'review';
    }
  | {
      screen: 'events';
      unitId: string;
      from: string;
      to: string;
      filter: 'uncoded';
    }
  | { screen: 'stop_merge'; eventId: string; reconciliationId: string }
  | { screen: 'stop_merges'; unitId: string; from: string; to: string }
  /** a period no plan covers: the period workspace is not reachable yet */
  | { screen: 'none' };

/** One open problem of one period (plan 2.4). */
export interface ReconciliationExceptionV2View {
  /** `<periodId>:<type>` */
  id: string;
  type: ExceptionType;
  periodId: string;
  unitId: string;
  unitName: string | null;
  planId: string | null;
  localDate: string;
  shiftName: string | null;
  utcStart: string;
  utcEnd: string;
  workflowState: ExceptionWorkflow;
  revision: number | null;
  /** slices, stops or suggestions concerned (1 for a stale submission) */
  count: number;
  message: string;
  target: ExceptionTarget;
}

const MAX_DETAIL = 160;

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

const clip = (text: string) =>
  text.length > MAX_DETAIL ? `${text.slice(0, MAX_DETAIL - 1)}…` : text;

function quantity(row: ExceptionRow): string {
  const amount = toDec(row.amount);
  if (amount === null) return '';
  return `${formatDec(amount)}${row.uom ? ` ${row.uom}` : ''}`;
}

const MESSAGES: Readonly<Record<ExceptionType, (row: ExceptionRow) => string>> =
  {
    residual_beyond_tolerance: (row) =>
      row.n === 1
        ? `Residual ${quantity(row)} beyond tolerance in the latest calculation`
        : `${row.n} product slices with a residual beyond tolerance in the latest calculation (largest ${quantity(row)})`,
    claim_exceeds_component: (row) =>
      `Declared quality or slowdown quantities exceed the measured component (${plural(row.n, 'slice', 'slices')})`,
    bridge_required: (row) =>
      `Loss candidates exceed the plan gap: a bridge decision is needed (${plural(row.n, 'slice', 'slices')})`,
    plan_allocation_required: (row) =>
      `No planned rate splits the plan: allocate the plan loss (${plural(row.n, 'slice', 'slices')})`,
    stale_submission: (row) =>
      `The submitted reconciliation is stale${row.detail ? `: ${clip(row.detail)}` : ''}`,
    substitute_source: (row) =>
      `Actuals of ${plural(row.n, 'product slice', 'product slices')} come from a substitute source${row.detail ? ` (${clip(row.detail)})` : ''}`,
    uncoded_stop_time: (row) =>
      `${plural(row.n, 'stop', 'stops')} without a reason in this period`,
    duplicate_merge_pending: (row) =>
      `${plural(row.n, 'duplicate-stop suggestion waits', 'duplicate-stop suggestions wait')} for a decision`,
  };

const SECTION: Partial<Record<ExceptionType, 'actuals' | 'review'>> = {
  stale_submission: 'review',
  substitute_source: 'actuals',
};

function targetOf(
  row: ExceptionRow,
  window: { from: string; to: string },
): ExceptionTarget {
  if (row.type === 'uncoded_stop_time') {
    return {
      screen: 'events',
      unitId: row.unit_id,
      ...window,
      filter: 'uncoded',
    };
  }
  if (row.type === 'duplicate_merge_pending') {
    return row.n === 1 && row.ref_id && row.ref_event_id
      ? {
          screen: 'stop_merge',
          eventId: row.ref_event_id,
          reconciliationId: row.ref_id,
        }
      : { screen: 'stop_merges', unitId: row.unit_id, ...window };
  }
  if (!row.plan_id) return { screen: 'none' };
  return {
    screen: 'period',
    planId: row.plan_id,
    periodId: row.period_id,
    section: SECTION[row.type] ?? 'reconciliation',
  };
}

export function toExceptionView(
  row: ExceptionRow,
): ReconciliationExceptionV2View {
  const window = {
    from: new Date(row.utc_start).toISOString(),
    to: new Date(row.utc_end).toISOString(),
  };
  return {
    id: `${row.period_id}:${row.type}`,
    type: row.type,
    periodId: row.period_id,
    unitId: row.unit_id,
    unitName: row.unit_name,
    planId: row.plan_id,
    localDate: row.local_date,
    shiftName: row.shift_name,
    utcStart: window.from,
    utcEnd: window.to,
    workflowState: row.workflow,
    revision: row.revision,
    count: row.n,
    message: MESSAGES[row.type](row),
    target: targetOf(row, window),
  };
}
