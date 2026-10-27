import { Decimal } from 'decimal.js';
import { Dec, formatDec, ZERO } from '../actuals/decimal';
import { isWeighted } from '../events/reason-weights';
import {
  LossEvent,
  LossKind,
  LossLineDraft,
  PeriodAccountingInput,
  SliceInput,
} from './accounting.types';
import { autoKey } from './auto-key';
import { sumOf } from './claims';
import { reasonPart } from './reason-split';
import { segmentSlice } from './segmentation';
import { timeLines } from './time-lines';

/** Line flag naming the declared shortfall a share line was cut from: `declared_shortfall:<quantity>`. */
export const DECLARED_SHORTFALL_FLAG = 'declared_shortfall';
/** Plan-totals flag of the stops cross-check: `stops_cross_check:<quantity>:<uom>` (information, never a line). */
export const STOPS_CROSS_CHECK_FLAG = 'stops_cross_check';

const SCALE = 8;

/** One reason of the declared shortfall: the cause (the event, per reason when split) and its weight. */
interface ReasonShare {
  cause: LossEvent;
  weight: Dec;
}

/** The reasons of a production loss: its weighted split, else its single reason (weight 1), else none. */
function sharesOf(event: LossEvent): ReasonShare[] {
  const weights = event.reasonWeights;
  if (isWeighted(weights)) {
    return weights.map((reason) => ({
      cause: reasonPart(event, reason),
      weight: new Dec(reason.weight),
    }));
  }
  return event.reasonCodeId ? [{ cause: event, weight: new Dec(1) }] : [];
}

/**
 * `shortfall × weight` rounded to 8 places; the last share takes the remainder, so the parts add up to
 * the shortfall exactly.
 */
export function shareQuantities(
  shortfall: Dec,
  weights: readonly Dec[],
): Dec[] {
  if (weights.length === 0) return [];
  const head = weights
    .slice(0, -1)
    .map((w) =>
      shortfall.mul(w).toDecimalPlaces(SCALE, Decimal.ROUND_HALF_EVEN),
    );
  return [...head, shortfall.minus(sumOf(head))];
}

function kindOf(input: PeriodAccountingInput, reasonCodeId: string): LossKind {
  return input.reasonComponents?.[reasonCodeId] ?? 'unaccounted_classified';
}

function shareLine(
  input: PeriodAccountingInput,
  slice: SliceInput,
  share: ReasonShare & { quantity: Dec; shortfall: Dec },
): LossLineDraft {
  const { cause } = share;
  const kind = kindOf(input, cause.reasonCodeId ?? '');
  return {
    ledger: 'plan',
    kind,
    sliceId: slice.sliceId,
    segmentStart: slice.window.start,
    segmentEnd: slice.window.end,
    quantity: share.quantity,
    uom: slice.uom,
    basis: 'declared',
    rateVersionId: null,
    cause,
    scheduleClass: cause.scheduleClass,
    oeeComponent: kind === 'unaccounted_classified' ? null : kind,
    flags: [`${DECLARED_SHORTFALL_FLAG}:${formatDec(share.shortfall)}`],
    evidence: [
      {
        eventId: cause.eventId,
        eventRevisionId: cause.revisionId,
        occurrenceId: cause.occurrenceId,
        share: share.weight.toFixed(SCALE),
        clippedStart: cause.start,
        clippedEnd: cause.end ?? slice.window.end,
      },
    ],
    autoKey: autoKey(
      { ledger: 'plan', kind, sliceId: slice.sliceId },
      slice.window.start,
      cause,
    ),
  };
}

/**
 * Declared mode (spec §4, Global Constraint 12): one plan line per reason share of the declared
 * shortfall, `basis = declared`, kind = the reason's OEE component (`unaccounted_classified` without
 * one). An uncoded event has no lines (its shortfall stays in the residual); a shortfall ≤ 0 is no loss.
 */
export function declaredLines(
  input: PeriodAccountingInput,
  slice: SliceInput,
  event: LossEvent,
): LossLineDraft[] {
  const shortfall = new Dec(event.declaredFigures?.shortfall ?? 0);
  if (shortfall.lte(ZERO)) return [];
  const shares = sharesOf(event);
  const quantities = shareQuantities(
    shortfall,
    shares.map((s) => s.weight),
  );
  return shares.map((share, i) =>
    shareLine(input, slice, { ...share, quantity: quantities[i], shortfall }),
  );
}

/**
 * The stops cross-check (information only): Σ clipped full-stop time of the slice × the approved planning
 * rate. Null when the slice has no planning rate or a stopped segment has none; the segment count is
 * reported with the run's statistics.
 */
export function stopsAtPlanningRate(
  input: PeriodAccountingInput,
  slice: SliceInput,
): { quantity: Dec; segments: number } | null {
  if (slice.planningRates.length === 0) return null;
  const segments = segmentSlice(input, slice, true);
  const stopped = segments.filter((s) => !s.excluded && s.stops.length > 0);
  if (stopped.some((s) => s.planning === null)) return null;
  const lines = timeLines(stopped, {
    ledger: 'plan',
    sliceId: slice.sliceId,
    uom: slice.uom,
    basis: 'planning',
  });
  const quantity = sumOf(
    lines.filter((l) => l.kind === 'availability').map((l) => l.quantity),
  );
  return { quantity, segments: segments.length };
}

/** The cross-check figure as a totals flag, `stops_cross_check:<quantity>:<uom>`. */
export function stopsCrossCheckFlag(quantity: Dec, uom: string | null): string {
  return `${STOPS_CROSS_CHECK_FLAG}:${formatDec(quantity)}:${uom ?? ''}`;
}

/** Reads the cross-check flag back as `{ stops_cross_check: { quantity, uom } }`; null when absent. */
export function readStopsCrossCheck(
  flags: readonly string[],
): { stops_cross_check: { quantity: string; uom: string | null } } | null {
  const prefix = `${STOPS_CROSS_CHECK_FLAG}:`;
  const flag = flags.find((f) => f.startsWith(prefix));
  if (!flag) return null;
  const [quantity, uom] = flag.slice(prefix.length).split(':');
  return { stops_cross_check: { quantity, uom: uom || null } };
}
