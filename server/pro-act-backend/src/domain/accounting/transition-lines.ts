import { Dec, ZERO } from '../actuals/decimal';
import { LossKind, LossLineDraft } from './accounting.types';
import { autoKey } from './auto-key';
import {
  NO_TRANSITION_STANDARD,
  standardFlag,
  TRANSITION_OFF_GRADE,
  TRANSITION_OVERRUN,
  TransitionSplit,
} from './transition-split';

/** The loss kinds of grade transitions (LA-08); their `oee_component` says which OEE component holds them. */
export const TRANSITION_KINDS: ReadonlySet<LossKind> = new Set([
  'transition_allowance',
  'transition_excess',
]);

type Component = 'performance' | 'quality' | 'availability';

function part(
  line: LossLineDraft,
  kind: LossKind,
  quantity: Dec,
  flags: string[],
): LossLineDraft {
  return {
    ...line,
    kind,
    quantity,
    flags: [...line.flags, ...flags],
    autoKey: autoKey(
      { ledger: line.ledger, kind, sliceId: line.sliceId },
      line.segmentStart,
      line.cause,
      line.oeeComponent ?? undefined,
    ),
  };
}

/**
 * The claim line of a grade transition as its allowance (within the approved standard) and its excess
 * (beyond it, `transition_overrun`; all of it without a standard, `no_transition_standard`). The two
 * add up to the claim exactly; a zero part gets no line. Off-grade lines carry their own quality class.
 */
export function transitionLines(
  line: LossLineDraft,
  split: TransitionSplit,
  component: Component,
): LossLineDraft[] {
  const share = component === 'quality' ? split.offGrade : split.rate;
  const allowed = line.quantity.mul(share);
  const excess = line.quantity.minus(allowed);
  const common = [
    ...(split.standardId ? [standardFlag(split.standardId)] : []),
    ...(component === 'quality' ? [TRANSITION_OFF_GRADE] : []),
  ];
  const lines: LossLineDraft[] = [];
  if (allowed.gt(ZERO))
    lines.push(part(line, 'transition_allowance', allowed, common));
  if (excess.gt(ZERO)) {
    const why = split.standardId ? TRANSITION_OVERRUN : NO_TRANSITION_STANDARD;
    lines.push(part(line, 'transition_excess', excess, [...common, why]));
  }
  return lines;
}

/** Σ of an OEE component over a ledger's lines: its own kind plus the transition lines it holds. */
export function componentTotal(
  lines: readonly LossLineDraft[],
  component: Component,
): Dec {
  return lines
    .filter(
      (l) =>
        l.kind === component ||
        (TRANSITION_KINDS.has(l.kind) && l.oeeComponent === component),
    )
    .reduce((sum, l) => sum.plus(l.quantity), ZERO);
}
