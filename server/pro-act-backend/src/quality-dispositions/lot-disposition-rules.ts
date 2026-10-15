import { Dec, formatDec, toDec } from '../domain/actuals/decimal';
import {
  DispositionClass,
  RECOVERABLE_CLASSES,
} from '../domain/actuals/period/quality-classes';
import { invalid } from '../profiles/profile-errors';

/** A lot disposition or recovery movement as proposed (SME E3). */
export interface NewLotDisposition {
  unitId: string;
  productId: string;
  lotCode: string;
  dispositionClass: DispositionClass;
  quantity: string;
  uom: string;
  productionStart: string;
  productionEnd: string;
  labReleasedAt?: string | null;
  recoveryOfId?: string | null;
  remeasured?: boolean;
  productionEventId?: string | null;
  supersedesId?: string | null;
  reason?: string | null;
  evidenceRef?: string | null;
}

export interface CheckedShape {
  quantity: Dec;
  start: Date;
  end: Date;
}

/** The disposition a recovery names, as far as the rules need it. */
export interface RecoveredOriginal {
  state: string;
  dispositionClass: DispositionClass;
  quantity: string;
  uom: string;
  productionStart: Date;
}

/**
 * 422 unless the quantity is > 0, the production interval is non-empty and not in the future (output
 * not made yet has no disposition), and a recovery is exactly a `recovered` row with its original
 * (`remeasured` only on a recovery).
 */
export function checkShape(input: NewLotDisposition, now: Date): CheckedShape {
  const quantity = toDec(input.quantity);
  if (!quantity || quantity.lte(0))
    throw invalid('INVALID_QUANTITY', 'quantity must be a decimal > 0');
  const start = new Date(input.productionStart);
  const end = new Date(input.productionEnd);
  if (!(start < end))
    throw invalid(
      'INVALID_RANGE',
      'productionEnd must be after productionStart',
    );
  if (end > now)
    throw invalid('INVALID_RANGE', 'productionEnd must not be in the future');
  const recovery = input.dispositionClass === 'recovered';
  if (recovery !== Boolean(input.recoveryOfId)) {
    throw invalid(
      'INVALID_RECOVERY',
      'a recovered quantity names the disposition it recovers (recoveryOfId), and only it does',
    );
  }
  if (input.remeasured && !recovery)
    throw invalid('INVALID_RECOVERY', 'remeasured applies to a recovery only');
  return { quantity, start, end };
}

/**
 * A recovery recovers an approved downgrade, transition off-grade or rework of the same unit of measure,
 * produced before it, and never more than that disposition held (Σ open and approved recoveries).
 */
export function checkRecovery(
  shape: CheckedShape & { uom: string },
  original: RecoveredOriginal,
  alreadyRecovered: Dec,
): void {
  if (original.state !== 'approved')
    throw invalid(
      'INVALID_RECOVERY',
      'only an approved disposition is recovered',
    );
  if (!RECOVERABLE_CLASSES.includes(original.dispositionClass)) {
    throw invalid(
      'NOT_RECOVERABLE',
      `a ${original.dispositionClass} quantity is not recovered (downgrade, transition_off_grade or rework only)`,
    );
  }
  if (original.uom.trim().toLowerCase() !== shape.uom.trim().toLowerCase())
    throw invalid('UOM_MISMATCH', 'a recovery uses the unit of its original');
  if (shape.start < original.productionStart)
    throw invalid('INVALID_RANGE', 'a recovery is produced after its original');
  const left = new Dec(original.quantity).minus(alreadyRecovered);
  if (shape.quantity.gt(left)) {
    throw invalid(
      'RECOVERY_EXCEEDS_DISPOSITION',
      `at most ${formatDec(left)} ${original.uom} of this disposition is left to recover`,
    );
  }
}
