import { UnprocessableEntityException } from '@nestjs/common';
import { ProductionEvent } from '../../production-event/production-event.entity';

/** The LA-08 / SME Q10 links of an event body: grade change products and the stop it recovers from. */
export interface GradeLinks {
  fromProductId?: string | null;
  toProductId?: string | null;
  recoveryOfEventId?: string | null;
}

function unprocessable(code: string, field: string, message: string) {
  return new UnprocessableEntityException({
    code,
    message: [message],
    fieldErrors: [{ field, message }],
  });
}

/**
 * LA-08: a `grade_transition` names both products, and they differ; any other event names none
 * (422 INVALID_GRADE_CHANGE). Values are the effective ones after the write.
 */
export function assertGradeChange(
  physicalType: string,
  links: { fromProductId: string | null; toProductId: string | null },
): void {
  const { fromProductId: from, toProductId: to } = links;
  if (physicalType !== 'grade_transition') {
    if (from || to) {
      throw unprocessable(
        'INVALID_GRADE_CHANGE',
        'fromProductId',
        'only a grade_transition names products',
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
  locked: Pick<ProductionEvent, 'fromProductId' | 'toProductId'>,
  dto: GradeLinks,
): { fromProductId: string | null; toProductId: string | null } {
  return {
    fromProductId:
      dto.fromProductId === undefined ? locked.fromProductId : dto.fromProductId,
    toProductId:
      dto.toProductId === undefined ? locked.toProductId : dto.toProductId,
  };
}

/** Columns of the links; `undefined` leaves a column untouched, `null` clears it. */
export function gradeLinkColumns(dto: GradeLinks): Partial<ProductionEvent> {
  const columns: Partial<ProductionEvent> = {};
  if (dto.fromProductId !== undefined) columns.fromProductId = dto.fromProductId;
  if (dto.toProductId !== undefined) columns.toProductId = dto.toProductId;
  if (dto.recoveryOfEventId !== undefined)
    columns.recoveryOfEventId = dto.recoveryOfEventId;
  return columns;
}
