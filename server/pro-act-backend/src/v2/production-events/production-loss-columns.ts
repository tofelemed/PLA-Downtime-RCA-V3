import { UnprocessableEntityException } from '@nestjs/common';
import {
  DeclaredFigures,
  parseDeclaredFigures,
} from '../../domain/events/declared-figures';
import { PhysicalType } from '../../domain/events/event-classification';
import { ProductionEvent } from '../../production-event/production-event.entity';
import {
  LossColumns,
  resolveLossColumns,
} from '../../production-event/production-loss';
import { ProductionEventV2EditableDto } from './production-event-v2-write.dto';

/** The request's declared figures as typed figures (undefined = not sent). */
export function figuresOf(
  dto: Pick<ProductionEventV2EditableDto, 'declaredFigures'>,
): DeclaredFigures | undefined {
  if (dto.declaredFigures === undefined) return undefined;
  return parseDeclaredFigures(dto.declaredFigures) ?? undefined;
}

function onlyOnLoss(): UnprocessableEntityException {
  const message = 'declaredFigures belong to production_loss events only';
  return new UnprocessableEntityException({
    code: 'VALIDATION_FAILED',
    message: [message],
    fieldErrors: [{ field: 'declaredFigures', message }],
  });
}

/**
 * Columns the declared figures own on a write: for a `production_loss` event the figures and the quantity
 * (the shortfall, 422 when a stated quantity differs); nothing for other kinds, which refuse figures.
 * On a PATCH only a request that states the quantity or the figures writes them (`stored` is the row).
 */
export function lossColumnsOf(
  physicalType: PhysicalType,
  dto: ProductionEventV2EditableDto,
  stored?: ProductionEvent,
): Partial<LossColumns> {
  if (physicalType !== 'production_loss') {
    if (dto.declaredFigures !== undefined) throw onlyOnLoss();
    return {};
  }
  if (dto.quantity === undefined && dto.declaredFigures === undefined) {
    return {};
  }
  return resolveLossColumns({
    quantity: dto.quantity,
    declaredFigures: figuresOf(dto) ?? stored?.declaredFigures,
  });
}
