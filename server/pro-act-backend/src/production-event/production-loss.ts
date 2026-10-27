import { UnprocessableEntityException } from '@nestjs/common';
import { DeclaredFigures } from '../domain/events/declared-figures';
import { EventClassification } from '../domain/events/event-classification';

/** Largest difference between a stated quantity and the declared shortfall that still counts as equal (column scale 8). */
const QUANTITY_EPSILON = 1e-8;

/** The classification a production loss event always has: measured tonnes, no OEE component. */
export const PRODUCTION_LOSS_AXES: Pick<
  EventClassification,
  'impactMode' | 'oeeComponent'
> = { impactMode: 'measured', oeeComponent: 'none' };

/** The columns the declared figures own: the quantity is always the shortfall. */
export interface LossColumns {
  quantity: number | null;
  declaredFigures: DeclaredFigures | null;
}

function invalid(field: string, message: string): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'VALIDATION_FAILED',
    message: [message],
    fieldErrors: [{ field, message }],
  });
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The figures are the source of truth for the quantity: without a stated quantity it becomes the
 * shortfall; a stated quantity that differs from the shortfall is 422 (VALIDATION_FAILED) naming both.
 */
export function resolveLossColumns(input: {
  quantity?: string | number | null;
  declaredFigures?: DeclaredFigures | null;
}): LossColumns {
  const figures = input.declaredFigures ?? null;
  const stated = toNumber(input.quantity);
  if (!figures) return { quantity: stated, declaredFigures: null };
  if (
    stated !== null &&
    Math.abs(stated - figures.shortfall) > QUANTITY_EPSILON
  ) {
    throw invalid(
      'quantity',
      `quantity ${stated} differs from declaredFigures.shortfall ${figures.shortfall}; send one of them or equal values`,
    );
  }
  return { quantity: figures.shortfall, declaredFigures: figures };
}

/**
 * A production loss has an end (so it is closed), declared figures with a shortfall of 0 or more (a
 * negative one is refused, whatever path wrote it) and a quantity equal to the shortfall.
 */
export function assertProductionLossValid(effective: {
  endTime: Date | null;
  columns: LossColumns;
}): void {
  if (!effective.endTime) {
    throw invalid('endTime', 'A production loss event needs an endTime');
  }
  if (!effective.columns.declaredFigures) {
    throw invalid(
      'declaredFigures',
      'A production loss event needs declaredFigures',
    );
  }
  if (effective.columns.declaredFigures.shortfall < 0) {
    throw invalid(
      'declaredFigures.shortfall',
      'The declared shortfall cannot be negative',
    );
  }
  if (effective.columns.quantity === null) {
    throw invalid('quantity', 'A production loss event needs a quantity');
  }
}
