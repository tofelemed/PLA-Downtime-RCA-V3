import { UnprocessableEntityException } from '@nestjs/common';
import { ProductionEvent } from '../../production-event/production-event.entity';

/** SME E3: dispositions a quality_loss event may name (lot dispositions carry the other classes). */
export const EVENT_DISPOSITION_CLASSES = [
  'downgrade',
  'scrap',
  'rework',
] as const;
export type EventDispositionClass = (typeof EVENT_DISPOSITION_CLASSES)[number];

export interface DispositionBody {
  dispositionClass?: EventDispositionClass | null;
}

/**
 * Only a quality_loss event names a disposition (422 INVALID_DISPOSITION_CLASS). `effective` is the value
 * after the write: the body's where given, else the stored one.
 */
export function assertDispositionClass(
  physicalType: string,
  effective: string | null,
): void {
  if (!effective || physicalType === 'quality_loss') return;
  const message = 'only a quality_loss event names a disposition class';
  throw new UnprocessableEntityException({
    code: 'INVALID_DISPOSITION_CLASS',
    message: [message],
    fieldErrors: [{ field: 'dispositionClass', message }],
  });
}

/** The column of the body; `undefined` leaves it untouched, `null` clears it. */
export function dispositionColumns(
  body: DispositionBody,
): Partial<ProductionEvent> {
  return body.dispositionClass === undefined
    ? {}
    : { dispositionClass: body.dispositionClass };
}
