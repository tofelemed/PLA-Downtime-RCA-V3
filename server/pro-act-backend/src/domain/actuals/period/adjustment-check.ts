import { Dec, formatDec, ZERO } from '../decimal';
import { AdjustmentKind } from './period-actuals.types';

/** The latest actuals of a slice (`actuals_results`), approved adjustments included. */
export interface SliceActualsNow {
  basis: 'gross' | 'good';
  gross: Dec | null;
  good: Dec | null;
  reject: Dec | null;
}

export interface AdjustmentDelta {
  kind: AdjustmentKind;
  quantity: Dec;
}

export interface AdjustmentViolation {
  code:
    | 'ADJUSTMENT_NEGATIVE_GROSS'
    | 'ADJUSTMENT_NEGATIVE_GOOD'
    | 'ADJUSTMENT_NEGATIVE_REJECT'
    | 'ADJUSTMENT_GOOD_EXCEEDS_GROSS';
  message: string;
  details: { gross: string | null; good: string | null; reject: string | null };
}

const plus = (a: Dec | null, b: Dec | null) =>
  a === null ? b : b === null ? a : a.plus(b);

function sumOf(deltas: readonly AdjustmentDelta[], kind: AdjustmentKind) {
  const rows = deltas.filter((d) => d.kind === kind);
  return rows.length === 0
    ? null
    : rows.reduce((total, d) => total.plus(d.quantity), ZERO);
}

/**
 * The slice's actuals once `deltas` are added, by the rules of `applyAdjustments` (slice-actuals.ts):
 * gross basis → gross += gross deltas, reject += reject deltas and good = gross − reject + good deltas
 * (linear, so it is applied to the current good); good basis → good += good deltas, gross stays unknown.
 * Rework acceptance is recovered output, never first-pass good (SME E3), so it changes neither.
 */
export function projectActuals(
  now: SliceActualsNow,
  deltas: readonly AdjustmentDelta[],
): SliceActualsNow {
  const [gross, reject, good] = (['gross', 'reject', 'good'] as const).map(
    (kind) => sumOf(deltas, kind),
  );
  if (now.basis === 'good') {
    return { ...now, good: plus(now.good, good) };
  }
  const nextGross = plus(now.gross, gross);
  const nextReject = plus(now.reject, reject);
  const derived =
    now.good !== null
      ? now.good
          .plus(gross ?? ZERO)
          .minus(reject ?? ZERO)
          .plus(good ?? ZERO)
      : nextGross === null
        ? null
        : nextGross.minus(nextReject ?? ZERO).plus(good ?? ZERO);
  return {
    basis: 'gross',
    gross: nextGross,
    good: derived,
    reject: nextReject,
  };
}

/**
 * Why actuals cannot be booked (ACT06 with ACC01: the engine refuses negative gross, good above gross
 * and negative quantities, so an adjustment that leads there is refused when proposed or approved,
 * never left to fail the calculation run). Null when the projected actuals are possible.
 */
export function adjustmentViolation(
  projected: SliceActualsNow,
): AdjustmentViolation | null {
  const details = {
    gross: projected.gross === null ? null : formatDec(projected.gross),
    good: projected.good === null ? null : formatDec(projected.good),
    reject: projected.reject === null ? null : formatDec(projected.reject),
  };
  const violation = (
    code: AdjustmentViolation['code'],
    message: string,
  ): AdjustmentViolation => ({ code, message, details });
  const { gross, good, reject } = projected;
  if (gross !== null && gross.lt(ZERO))
    return violation('ADJUSTMENT_NEGATIVE_GROSS', 'gross would be negative');
  if (good !== null && good.lt(ZERO))
    return violation('ADJUSTMENT_NEGATIVE_GOOD', 'good would be negative');
  if (reject !== null && reject.lt(ZERO))
    return violation('ADJUSTMENT_NEGATIVE_REJECT', 'rejects would be negative');
  if (gross !== null && good !== null && good.gt(gross)) {
    return violation(
      'ADJUSTMENT_GOOD_EXCEEDS_GROSS',
      'good would exceed gross (negative quality loss): book a measured output correction on gross, not on good',
    );
  }
  return null;
}
