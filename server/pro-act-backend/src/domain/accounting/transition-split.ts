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

/** The approved standard of the event's product change in force at its start, else null. */
export function standardFor(
  event: LossEvent,
  standards: readonly TransitionStandard[],
): TransitionStandard | null {
  const change = event.transition;
  if (!change) return null;
  return (
    standards.find(
      (s) =>
        s.fromProductId === change.fromProductId &&
        s.toProductId === change.toProductId &&
        s.from <= event.start &&
        (s.to === null || s.to > event.start),
    ) ?? null
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
 * The allowance of a transition: reference duration ÷ actual duration (open events measured to
 * `asOf`), capped at 1; the off-grade allowance is bounded by the reference off-grade quantity when the
 * standard has one.
 */
export function transitionSplit(
  event: LossEvent,
  standards: readonly TransitionStandard[],
  asOf: Date,
): TransitionSplit {
  const standard = standardFor(event, standards);
  if (!standard) return { standardId: null, rate: ZERO, offGrade: ZERO };
  const end = (event.end ?? asOf).getTime();
  const actual = secondsBetween(event.start.getTime(), end);
  const reference = new Dec(standard.referenceSeconds);
  const time = actual.lte(ZERO) ? ONE : atMostOne(reference.div(actual));
  return {
    standardId: standard.id,
    rate: time,
    offGrade: offGradeShare(event, standard, time),
  };
}
