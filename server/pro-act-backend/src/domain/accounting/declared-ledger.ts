import { Dec, toDec, ZERO } from '../actuals/decimal';
import { declaredIdentityGap } from '../events/declared-figures';
import {
  LedgerTotals,
  LossEvent,
  LossLineDraft,
  PeriodAccounting,
  PeriodAccountingInput,
  SliceInput,
} from './accounting.types';
import { sumOf } from './claims';
import { checkConservation } from './conservation';
import {
  declaredLines,
  stopsAtPlanningRate,
  stopsCrossCheckFlag,
} from './declared-lines';
import { emptyTotals, productionOf, sliceLine } from './ledger-common';
import { planTotals } from './plan-totals';
import { componentTotal } from './transition-lines';

/** Flags of declared-mode plan totals (Global Constraint 12, D4). */
export const DECLARED_LOSS_MISSING = 'declared_loss_missing';
export const DECLARED_IDENTITY_MISMATCH = 'declared_identity_mismatch';
export const DECLARED_TARGET_MISSING = 'declared_target_missing';
export const DECLARED_ACTUAL_MISSING = 'declared_actual_missing';
export const DUPLICATE_DECLARED_LOSS = 'duplicate_declared_loss';
/** Data flag beside `duplicate_declared_loss`: `declared_loss_chosen:<event id>`, the event the figures come from. */
export const DECLARED_LOSS_CHOSEN_PREFIX = 'declared_loss_chosen:';
export const DECLARED_SINGLE_SLICE = 'declared_single_slice';
export const CAPACITY_NOT_APPLICABLE = 'capacity_not_applicable';

interface Chosen {
  event: LossEvent | null;
  duplicate: boolean;
}

const byId = (a: LossEvent, b: LossEvent) =>
  a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0;

/** Earliest start, then the earliest recorded (`createdAt`; unknown last), then the lowest id. */
function declaredOrder(a: LossEvent, b: LossEvent): number {
  const created = (e: LossEvent) =>
    e.createdAt ? e.createdAt.getTime() : Number.MAX_SAFE_INTEGER;
  return (
    a.start.getTime() - b.start.getTime() ||
    created(a) - created(b) ||
    byId(a, b)
  );
}

/**
 * The period's production loss: the events with declared figures whose `[start, end)` equals the period
 * window; of several, deterministically the earliest start, then the earliest recorded, then the lowest id
 * (flagged `duplicate_declared_loss` with `declared_loss_chosen:<id>` naming the one used).
 */
export function chooseDeclaredEvent(input: PeriodAccountingInput): Chosen {
  const { start, end } = input.window;
  const matches = input.events
    .filter(
      (e) =>
        e.physicalType === 'production_loss' &&
        !!e.declaredFigures &&
        e.start.getTime() === start.getTime() &&
        e.end?.getTime() === end.getTime(),
    )
    .sort(declaredOrder);
  return { event: matches[0] ?? null, duplicate: matches.length > 1 };
}

interface Figure {
  value: Dec | null;
  flags: string[];
}

/** Target per `targetSource`: the OT planned figure, else the slice's plan target. */
function targetOf(
  input: PeriodAccountingInput,
  slice: SliceInput,
  event: LossEvent | null,
): Figure {
  if (input.policy.targetSource === 'declared') {
    const planned = toDec(event?.declaredFigures?.planned ?? null);
    return { value: planned, flags: planned ? [] : [DECLARED_TARGET_MISSING] };
  }
  const target = toDec(slice.target);
  return { value: target, flags: target ? [] : ['no_plan_target'] };
}

/** Actual = the OT actual; without one (or without an event) the slice's measured good. */
function actualOf(slice: SliceInput, event: LossEvent | null): Figure {
  const declared = toDec(event?.declaredFigures?.actual ?? null);
  if (declared) return { value: declared, flags: [] };
  const measured = productionOf(slice);
  const flags = event ? [DECLARED_ACTUAL_MISSING] : [];
  return { value: measured.good, flags: [...flags, ...measured.flags] };
}

function eventFlags(
  input: PeriodAccountingInput,
  chosen: Chosen,
  slices: number,
): string[] {
  const flags = [CAPACITY_NOT_APPLICABLE];
  if (slices > 1) flags.push(DECLARED_SINGLE_SLICE);
  if (chosen.duplicate && chosen.event) {
    flags.push(
      DUPLICATE_DECLARED_LOSS,
      `${DECLARED_LOSS_CHOSEN_PREFIX}${chosen.event.eventId}`,
    );
  }
  const figures = chosen.event?.declaredFigures;
  if (!figures) return [...flags, DECLARED_LOSS_MISSING];
  const tolerance = input.policy.identityTolerance ?? 0;
  if (Math.abs(declaredIdentityGap(figures)) > tolerance)
    flags.push(DECLARED_IDENTITY_MISMATCH);
  return flags;
}

/** The declared figures are in another unit than the slice: never converted, so they are not used. */
function uomMismatch(slice: SliceInput, event: LossEvent | null): boolean {
  const uom = event?.declaredFigures?.uom;
  return !!uom && !!slice.uom && uom !== slice.uom;
}

interface SliceResult {
  lines: LossLineDraft[];
  totals: LedgerTotals;
}

function declaredTotals(
  slice: SliceInput,
  lines: readonly LossLineDraft[],
  given: { target: Figure; actual: Figure; flags: string[]; epsilon: Dec },
): LedgerTotals {
  const attributed = sumOf(lines.map((l) => l.quantity));
  const base = {
    ...emptyTotals(slice, 'plan', []),
    availability: componentTotal(lines, 'availability'),
    performance: componentTotal(lines, 'performance'),
    quality: componentTotal(lines, 'quality'),
    // Task 13: recovery shares are signed gain lines; the totals carry the recovery as a positive figure
    gain: ZERO.minus(
      sumOf(lines.filter((l) => l.kind === 'gain').map((l) => l.quantity)),
    ),
    good: given.actual.value,
    actual: given.actual.value,
    attributed,
  };
  const flags = [...given.flags, ...given.target.flags, ...given.actual.flags];
  if (!given.target.value) return { ...base, flags: [...new Set(flags)] };
  const plan = planTotals({
    target: given.target.value,
    actual: given.actual.value,
    attributed,
    epsilon: given.epsilon,
  });
  return {
    ...base,
    target: given.target.value,
    gap: plan.gap,
    residual: plan.residual,
    overproduction: plan.overproduction,
    overAccounted: plan.overAccounted,
    flags: [...new Set([...flags, ...plan.flags])],
  };
}

function declaredSlice(
  input: PeriodAccountingInput,
  slice: SliceInput,
  chosen: Chosen,
): SliceResult {
  const flags = eventFlags(input, chosen, input.slices.length);
  const epsilon = new Dec(input.policy.epsilon);
  if (uomMismatch(slice, chosen.event)) {
    return {
      lines: [],
      totals: emptyTotals(slice, 'plan', [...flags, 'uom_mismatch']),
    };
  }
  const lines = chosen.event ? declaredLines(input, slice, chosen.event) : [];
  const totals = declaredTotals(slice, lines, {
    target: targetOf(input, slice, chosen.event),
    actual: actualOf(slice, chosen.event),
    flags,
    epsilon,
  });
  if (totals.residual === null) return { lines, totals };
  const residual = sliceLine('residual', totals.residual, slice, {
    ledger: 'plan',
    sliceId: slice.sliceId,
    uom: slice.uom,
    basis: 'planning',
  });
  return { lines: [...lines, residual], totals };
}

/** With `stopsCrossCheck`, the recorded full stops priced at the planning rate, as a totals flag. */
function withCrossCheck(
  input: PeriodAccountingInput,
  slice: SliceInput,
  totals: LedgerTotals,
): { totals: LedgerTotals; segments: number } {
  if (input.policy.stopsCrossCheck !== true) return { totals, segments: 0 };
  const check = stopsAtPlanningRate(input, slice);
  if (!check) return { totals, segments: 0 };
  const flag = stopsCrossCheckFlag(check.quantity, slice.uom);
  return {
    totals: { ...totals, flags: [...totals.flags, flag] },
    segments: check.segments,
  };
}

/**
 * Declared mode (spec §4.4, Global Constraint 12): the plan ledger of the period's single slice (D4) is
 * the OT system's declared shortfall split by reason — target per `targetSource`, actual = the OT actual,
 * gap = target − actual (signed, never clamped), lines = shortfall × reason share, residual = gap −
 * attributed. Stops, slowdowns and quality events produce no lines (stops only feed the optional
 * cross-check figure); the capacity ledger is not computed (`capacity_not_applicable`). The result has
 * the shape of the computed engine's and passes the same conservation checks.
 */
export function computeDeclaredAccounting(
  given: PeriodAccountingInput,
): PeriodAccounting {
  const slice = given.slices[0];
  if (!slice) return { lines: [], totals: [], issues: [], segmentCount: 0 };
  const result = declaredSlice(given, slice, chooseDeclaredEvent(given));
  const checked = withCrossCheck(given, slice, result.totals);
  return {
    lines: result.lines,
    totals: [checked.totals],
    issues: checkConservation(
      result.lines,
      [checked.totals],
      new Dec(given.policy.epsilon),
    ),
    segmentCount: checked.segments,
  };
}
