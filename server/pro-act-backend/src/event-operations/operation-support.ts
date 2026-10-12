import {
  ConflictException,
  NotFoundException,
  PreconditionFailedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { RequestContext } from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import { OperationViolation } from '../domain/events/event-operations';
import { ProductionEvent } from '../production-event/production-event.entity';
import { EventChangeMessage } from '../production-event/revisions/event-change.notifier';
import { hasRevisionTenant } from '../production-event/revisions/revision-store';

/** What an event operation did (the v2 response body). */
export interface OperationOutcome {
  operation: 'split' | 'merge' | 'close' | 'retract';
  createdEventIds: string[];
  supersededEventIds: string[];
  updatedEventIds: string[];
  /** the physical stop occurrence the resulting events belong to */
  occurrenceId: string;
}

/** Outcome plus the change messages to publish after commit. */
export interface OperationResult {
  outcome: OperationOutcome;
  messages: EventChangeMessage[];
}

/**
 * `SELECT ... FOR UPDATE` of events in the caller's tenant and unit scope, locked in id order (no
 * deadlock between concurrent operations). Missing ids are left out; callers decide on 404.
 */
export function lockScopedEvents(
  manager: EntityManager,
  context: RequestContext,
  ids: readonly string[],
): Promise<ProductionEvent[]> {
  return scopedQuery(manager.getRepository(ProductionEvent), 'event', {
    context,
    unitProperty: 'unitId',
  })
    .andWhere('event.id IN (:...ids)', { ids: [...new Set(ids)] })
    .orderBy('event.id', 'ASC')
    .setLock('pessimistic_write')
    .getMany();
}

/** Locks every id or answers 404 (a foreign id is indistinguishable from an unknown one). */
export async function lockAllOrNotFound(
  manager: EntityManager,
  context: RequestContext,
  ids: readonly string[],
): Promise<ProductionEvent[]> {
  const events = await lockScopedEvents(manager, context, ids);
  if (events.length !== new Set(ids).size) throw notFound();
  return events;
}

/** Locks one event of the caller's scope for an operation: 404, 409 (state), 412 (version). */
export async function lockOperable(
  manager: EntityManager,
  context: RequestContext,
  eventId: string,
  expectedVersion: number,
): Promise<ProductionEvent> {
  const [event] = await lockAllOrNotFound(manager, context, [eventId]);
  assertOperable(event);
  assertVersions([event], new Map([[event.id, expectedVersion]]));
  return event;
}

/** 409 INVALID_STATE for superseded/retracted events; 422 for legacy rows without a uuid tenant. */
export function assertOperable(event: ProductionEvent): void {
  if (
    event.physicalState === 'superseded' ||
    event.physicalState === 'retracted'
  ) {
    throw new ConflictException({
      code: 'INVALID_STATE',
      message: `Event ${event.id} is ${event.physicalState} and cannot be changed`,
    });
  }
  if (!hasRevisionTenant(event)) {
    throw new UnprocessableEntityException({
      code: 'EVENT_WITHOUT_TENANT',
      message: `Event ${event.id} has no uuid tenant and cannot be revised`,
    });
  }
}

/** 412 STALE_REVISION listing every event whose `row_version` is not the expected one. */
export function assertVersions(
  events: readonly ProductionEvent[],
  expected: ReadonlyMap<string, number>,
): void {
  const stale = events
    .filter((event) => expected.get(event.id) !== event.rowVersion)
    .map((event) => ({ eventId: event.id, currentVersion: event.rowVersion }));
  if (stale.length > 0) {
    throw new PreconditionFailedException({
      code: 'STALE_REVISION',
      message: 'The event changed since it was read',
      details: { stale },
    });
  }
}

export function notFound(): NotFoundException {
  return new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
}

/** Runs `work`; a domain rule violation becomes 422 with its code and details. */
export async function withViolations<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof OperationViolation) {
      throw new UnprocessableEntityException({
        code: error.code,
        message: [error.message],
        ...(error.details ? { details: error.details } : {}),
      });
    }
    throw error;
  }
}

/** Business id of an event derived by an operation: the source id stays unique to the source record. */
export function derivedEventId(
  eventId: string | null | undefined,
  suffix: string,
): string | null {
  if (!eventId) return null;
  return `${eventId.slice(0, 250 - suffix.length)}#${suffix}`;
}
