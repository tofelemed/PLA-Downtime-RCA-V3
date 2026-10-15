import { Dec, secondsBetween, toDec, ZERO } from '../actuals/decimal';
import { LossEvent, TransitionStandard } from './accounting.types';

/** Line flags of grade-transition loss (LA-08). */
export const NO_TRANSITION_STANDARD = 'no_transition_standard';
export const TRANSITION_OVERRUN = 'transition_overrun';
/** SME E3: transition off-grade is its own quality class, never mixed with scrap */
export const TRANSITION_OFF_GRADE = 'quality_class:transition_off_grade';
export const standardFlag = (id: string) => `transition_standard:${id}`;

/**
 * How much of a transition's loss the approved standard allows (SME Q9 / E1): `rate` applies to the
 * rate deficit, `offGrade` to the off-grade quantity; each is a share in [0, 1] of the event's whole
 * loss, so it holds for every slice and product-run share of it. No standard → both 0 (no reference
 * is ever invented: the whole transition is loss).
 */
export interface TransitionSplit {
  standardId: string | null;
  rate: Dec;
  offGrade: Dec;
}

const ONE = new Dec(1);
const atMostOne = (value: Dec) => (value.gt(ONE) ? ONE : value);

/** A key part of a standard matches when it is "any" (null) or equal to the change's value. */
const partMatches = (
  wanted: string | null | undefined,
  actual: string | null | undefined,
) => wanted == null || wanted === (actual ?? null);

/**
 * Specificity of a matching standard (SME E1): catalyst family outranks operating mode (the catalyst
 * system sets the transition chemistry; DECISIONS D-E1), so catalyst-only beats mode-only on a tie.
 */
const specificity = (standard: TransitionStandard) =>
  (standard.catalystFamily != null ? 2 : 0) +
  (standard.operatingMode != null ? 1 : 0);

/**
 * The approved standard of the event's product change in force at its start, else null. The key is
 * unit × from × to × catalyst family × operating mode (SME E1); a standard's null catalyst / mode means
 * "any", and the most specific matching entry wins. Without context on either side this is the
 * unit × from × to match of engine 2.5.5.
 */
export function standardFor(
  event: LossEvent,
  standards: readonly TransitionStandard[],
): TransitionStandard | null {
  const change = event.transition;
  if (!change) return null;
  const candidates = standards.filter(
    (s) =>
      s.fromProductId === change.fromProductId &&
      s.toProductId === change.toProductId &&
      partMatches(s.catalystFamily, change.catalystFamily) &&
      partMatches(s.operatingMode, change.operatingMode) &&
      s.from <= event.start &&
      (s.to === null || s.to > event.start),
  );
  return candidates.reduce<TransitionStandard | null>(
    (best, s) => (!best || specificity(s) > specificity(best) ? s : best),
    null,
  );
}

/** Share of the off-grade within the reference quantity; without one, the time share applies. */
function offGradeShare(
  event: LossEvent,
  standard: TransitionStandard,
  timeShare: Dec,
): Dec {
  const reference = toDec(standard.referenceOffgradeQuantity);
  const made = toDec(event.quantity);
  if (reference === null || made === null) return timeShare;
  return made.lte(ZERO) ? ONE : atMostOne(reference.div(made));
}

/**
 * Reference duration ÷ actual duration of a transition (open events measured to `asOf`), not capped: above
 * 1 when the change finished inside its standard. 0 without a standard; 1 for an event without duration.
 */
export function standardTimeRatio(
  event: LossEvent,
  standard: TransitionStandard | null,
  asOf: Date,
): Dec {
  if (!standard) return ZERO;
  const end = (event.end ?? asOf).getTime();
  const actual = secondsBetween(event.start.getTime(), end);
  if (actual.lte(ZERO)) return ONE;
  return new Dec(standard.referenceSeconds).div(actual);
}

/**
 * The allowance of a transition: reference duration ÷ actual duration, capped at 1; the off-grade
 * allowance is bounded by the reference off-grade quantity when the standard has one.
 */
export function transitionSplit(
  event: LossEvent,
  standards: readonly TransitionStandard[],
  asOf: Date,
): TransitionSplit {
  const standard = standardFor(event, standards);
  if (!standard) return { standardId: null, rate: ZERO, offGrade: ZERO };
  const time = atMostOne(standardTimeRatio(event, standard, asOf));
  return {
    standardId: standard.id,
    rate: time,
    offGrade: offGradeShare(event, standard, time),
  };
}
