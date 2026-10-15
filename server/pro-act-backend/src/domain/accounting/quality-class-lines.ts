import { Dec, ZERO } from '../actuals/decimal';
import {
  NON_CONFORMING_CLASSES,
  NonConformingClass,
  QualityClasses,
  qualityClassFlag,
} from '../actuals/period/quality-classes';
import { LossLineDraft } from './accounting.types';
import { autoKey } from './auto-key';

/** Line flag: the slice's classified quantity is larger than the quality loss left to classify. */
export const QUALITY_CLASSES_EXCEED_LOSS = 'quality_classes_exceed_loss';

const FIELD: Readonly<Record<NonConformingClass, keyof QualityClasses>> = {
  scrap: 'scrap',
  downgrade: 'downgrade',
  transition_off_grade: 'transitionOffGrade',
  rework: 'rework',
};

/** Σ of the component's lines already naming the class (quality events, transition off-grade). */
function claimedOf(lines: readonly LossLineDraft[], flag: string): Dec {
  return lines
    .filter((l) => l.cause !== null && l.flags.includes(flag))
    .reduce((sum, l) => sum.plus(l.quantity), ZERO);
}

function classPart(
  remainder: LossLineDraft,
  quantity: Dec,
  value: NonConformingClass,
): LossLineDraft {
  return {
    ...remainder,
    quantity,
    flags: [...remainder.flags, qualityClassFlag(value)],
    autoKey: autoKey(
      {
        ledger: remainder.ledger,
        kind: remainder.kind,
        sliceId: remainder.sliceId,
      },
      remainder.segmentStart,
      null,
      value,
    ),
  };
}

/**
 * SME E3: the quality loss no event explains, split by the slice's approved disposition classes (scrap,
 * downgrade, transition off-grade, rework, in that order), each class less what events of the same class
 * already claim — so a tonne recorded both by an operator event and a lot disposition is counted once.
 * What no class covers stays the plain line without cause; classes beyond the loss are capped and the
 * last class line is flagged `quality_classes_exceed_loss` (never scaled). No classes → lines unchanged.
 */
export function classifiedQualityLines(
  lines: LossLineDraft[],
  classes: QualityClasses | null | undefined,
  epsilon: Dec,
): LossLineDraft[] {
  const index = lines.findIndex((l) => l.kind === 'quality' && !l.cause);
  if (!classes || index < 0) return lines;
  const remainder = lines[index];
  let left = remainder.quantity;
  let exceeded = false;
  const parts: LossLineDraft[] = [];
  for (const value of NON_CONFORMING_CLASSES) {
    const flag = qualityClassFlag(value);
    const wanted = new Dec(classes[FIELD[value]] as string).minus(
      claimedOf(lines, flag),
    );
    if (wanted.lte(epsilon)) continue;
    if (wanted.gt(left.plus(epsilon))) exceeded = true;
    const take = wanted.gt(left) ? left : wanted;
    if (take.gt(ZERO)) parts.push(classPart(remainder, take, value));
    left = left.minus(take);
  }
  const last = parts[parts.length - 1];
  if (exceeded && last) last.flags.push(QUALITY_CLASSES_EXCEED_LOSS);
  const rest = left.gt(epsilon) ? [{ ...remainder, quantity: left }] : [];
  return [
    ...lines.slice(0, index),
    ...parts,
    ...rest,
    ...lines.slice(index + 1),
  ];
}
