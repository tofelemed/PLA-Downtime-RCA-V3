import { UnprocessableEntityException } from '@nestjs/common';
import { ProductionEvent } from '../../production-event/production-event.entity';

/** The LA-08 / SME Q10 links of an event body: grade change products and the stop it recovers from. */
export interface GradeLinks {
  fromProductId?: string | null;
  toProductId?: string | null;
  recoveryOfEventId?: string | null;
  /** SME E1: transition-standard context of a grade change */
  catalystFamily?: string | null;
  operatingMode?: string | null;
}

/** The effective grade-change fields of an event after a write. */
export interface EffectiveGradeLinks {
  fromProductId: string | null;
  toProductId: string | null;
  catalystFamily: string | null;
  operatingMode: string | null;
}

function unprocessable(code: string, field: string, message: string) {
  return new UnprocessableEntityException({
    code,
    message: [message],
    fieldErrors: [{ field, message }],
  });
}

/**
 * LA-08: a `grade_transition` names both products, and they differ; any other event names none, and no
 * catalyst family / operating mode either (SME E1) (422 INVALID_GRADE_CHANGE). Values are the effective
 * ones after the write.
 */
export function assertGradeChange(
  physicalType: string,
  links: EffectiveGradeLinks,
): void {
  const { fromProductId: from, toProductId: to } = links;
  if (physicalType !== 'grade_transition') {
    if (from || to || links.catalystFamily || links.operatingMode) {
      throw unprocessable(
        'INVALID_GRADE_CHANGE',
        from || to ? 'fromProductId' : 'catalystFamily',
        'only a grade_transition names products, catalyst family or operating mode',
      );
    }
    return;
  }
  if (!from || !to || from === to) {
    throw unprocessable(
      'INVALID_GRADE_CHANGE',
      'toProductId',
      'a grade_transition needs two different products (fromProductId, toProductId)',
    );
  }
}

/** The effective links after a PATCH: the body where given, else the stored value. */
export function effectiveLinks(
  locked: EffectiveGradeLinks,
  dto: GradeLinks,
): EffectiveGradeLinks {
  const pick = (key: keyof EffectiveGradeLinks) =>
    dto[key] === undefined ? locked[key] : (dto[key] ?? null);
  return {
    fromProductId: pick('fromProductId'),
    toProductId: pick('toProductId'),
    catalystFamily: pick('catalystFamily'),
    operatingMode: pick('operatingMode'),
  };
}

/** No grade-change fields (a new event's starting point). */
export const NO_GRADE_LINKS: EffectiveGradeLinks = {
  fromProductId: null,
  toProductId: null,
  catalystFamily: null,
  operatingMode: null,
};

/** Columns of the links; `undefined` leaves a column untouched, `null` clears it. */
export function gradeLinkColumns(dto: GradeLinks): Partial<ProductionEvent> {
  const columns: Partial<ProductionEvent> = {};
  if (dto.fromProductId !== undefined)
    columns.fromProductId = dto.fromProductId;
  if (dto.toProductId !== undefined) columns.toProductId = dto.toProductId;
  if (dto.recoveryOfEventId !== undefined)
    columns.recoveryOfEventId = dto.recoveryOfEventId;
  if (dto.catalystFamily !== undefined)
    columns.catalystFamily = dto.catalystFamily;
  if (dto.operatingMode !== undefined)
    columns.operatingMode = dto.operatingMode;
  return columns;
}
