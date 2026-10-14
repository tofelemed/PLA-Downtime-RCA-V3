import { UnprocessableEntityException } from '@nestjs/common';

/**
 * SME D4: the approved end of a planned stop's window must lie after the stop's start (422
 * PLANNED_END_BEFORE_START); null or absent = no approved window recorded.
 */
export function assertPlannedEnd(
  start: Date,
  plannedEnd: string | Date | null | undefined,
): void {
  if (plannedEnd === null || plannedEnd === undefined) return;
  if (new Date(plannedEnd).getTime() > start.getTime()) return;
  const message = 'plannedEndTime must be after the start of the stop';
  throw new UnprocessableEntityException({
    code: 'PLANNED_END_BEFORE_START',
    message: [message],
    fieldErrors: [{ field: 'plannedEndTime', message }],
  });
}

/** The column value of a body field: undefined leaves it, null clears it. */
export function plannedEndColumn(
  value: string | null | undefined,
): Date | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : new Date(value);
}
