import { Dec, ZERO } from '../actuals/decimal';
import { LossEvent } from '../accounting/accounting.types';
import { splitAmountByReason } from '../accounting/reason-split';
import { CauseSeconds } from './downtime-allocation';
import { DowntimeInput, stopKindOf } from './downtime-measures';
import { BreakdownDimension, KpiDraft, KpiScope } from './kpi.types';
import { amountKpi } from './kpi-values';

const DIMENSIONS: readonly BreakdownDimension[] = [
  'none',
  'reason',
  'impact',
  'oee_component',
  'asset',
];

function keyOf(event: LossEvent, dimension: BreakdownDimension): string | null {
  switch (dimension) {
    case 'reason':
      return event.reasonCodeId;
    case 'impact':
      return event.impactCodeId;
    case 'oee_component':
      return event.oeeComponent;
    case 'asset':
      return event.assetId ?? null;
    default:
      return null;
  }
}

interface Cell {
  scope: KpiScope;
  amount: Dec;
}

function scopeOf(
  input: DowntimeInput,
  event: LossEvent,
  dimension: BreakdownDimension,
  scheduleClass: string = event.scheduleClass,
): KpiScope {
  return {
    level: 'breakdown',
    dimension,
    key: keyOf(event, dimension),
    scheduleClass,
    stopKind: stopKindOf(input, event.occurrenceId),
  };
}

function addTo(cells: Map<string, Cell>, scope: KpiScope, amount: Dec): void {
  const id = JSON.stringify(scope);
  const cell = cells.get(id) ?? { scope, amount: ZERO };
  cell.amount = cell.amount.plus(amount);
  cells.set(id, cell);
}

/**
 * D-T5: by reason, a weighted stop's allocated seconds go to each of its reasons by weight (the parts add
 * up exactly); every other dimension, and an unweighted stop, keeps the whole amount.
 */
function piecesOf(
  part: CauseSeconds,
  dimension: BreakdownDimension,
): Array<{ event: LossEvent; amount: Dec }> {
  if (dimension !== 'reason')
    return [{ event: part.event, amount: part.seconds }];
  return splitAmountByReason(part.event, part.seconds);
}

/** The earliest event of each occurrence starting in the window: the occurrence's cause for counting. */
function startingCauses(input: DowntimeInput): LossEvent[] {
  const starts = new Map(
    input.occurrences
      .filter(
        (o) => o.start >= input.window.start && o.start < input.window.end,
      )
      .map((o) => [o.occurrenceId, o.start.getTime()]),
  );
  const first = new Map<string, LossEvent>();
  const ordered = [...input.events].sort(
    (a, b) =>
      a.start.getTime() - b.start.getTime() ||
      a.eventId.localeCompare(b.eventId),
  );
  for (const event of ordered) {
    if (starts.has(event.occurrenceId) && !first.has(event.occurrenceId)) {
      first.set(event.occurrenceId, event);
    }
  }
  return [...first.values()];
}

/**
 * Downtime breakdown rows (KPI05, report `GET /reports/downtime`): per dimension (none, reason, impact,
 * OEE component, asset) × schedule class × stop kind, the allocated seconds (`downtime_total`, adding up
 * to the period total in every dimension; a weighted stop's seconds split by reason weight) and the
 * occurrences starting in the window (`stop_count`, counted under their first event's codes — the primary
 * reason of a weighted stop).
 */
export function downtimeBreakdown(
  input: DowntimeInput,
  allocated: readonly CauseSeconds[],
): KpiDraft[] {
  const seconds = new Map<string, Cell>();
  const counts = new Map<string, Cell>();
  const starting = startingCauses(input);
  for (const dimension of DIMENSIONS) {
    for (const part of allocated) {
      for (const piece of piecesOf(part, dimension)) {
        addTo(
          seconds,
          scopeOf(input, piece.event, dimension, part.scheduleClass),
          piece.amount,
        );
      }
    }
    for (const event of starting) {
      addTo(counts, scopeOf(input, event, dimension), new Dec(1));
    }
  }
  return [
    ...[...seconds.values()].map((c) =>
      amountKpi({ metric: 'downtime_total', scope: c.scope }, c.amount),
    ),
    ...[...counts.values()].map((c) =>
      amountKpi(
        { metric: 'stop_count', scope: c.scope, unit: 'count' },
        c.amount,
      ),
    ),
  ];
}
