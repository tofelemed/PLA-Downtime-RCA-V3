import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { enqueueOutbox } from '../../common/outbox/outbox-writer';
import { RealtimeGateway } from '../../realtime.gateway';
import { ProductionEvent } from '../production-event.entity';
import { RevisionKind } from './event-revision.entity';
import { isUuid } from './revision-actor';

/**
 * Payload of the future `EventChanged` / `EventRetracted` outbox messages (spec API05 §15.4, plan 1.5):
 * the affected interval lets Phase 2 recalculate only the periods it touches. `affectedTo` is null
 * while the event is (or was) open.
 */
export interface EventChangeMessage {
  tenantId: string;
  eventId: string;
  /** unit of the event after the change; routes the scoped realtime message (plan 3.1) */
  unitId?: string | null;
  /** `event_revisions.revision` that caused the message */
  revision: number;
  affectedFrom: string;
  affectedTo: string | null;
  kind: RevisionKind;
}

export type EventChangeType = 'EventChanged' | 'EventRetracted';

/**
 * Domain-event seam for event revisions. `recordIn` writes `EventChanged` / `EventRetracted` to the
 * transactional outbox inside the revision's transaction (plan 1.5, FND02/API05: Phase 2 consumers read
 * them through the relay); after commit the same messages are broadcast over the realtime gateway for
 * open browsers (`productionEventChanged` / `productionEventRetracted`).
 */
@Injectable()
export class EventChangeNotifier {
  private readonly logger = new Logger(EventChangeNotifier.name);

  constructor(private readonly gateway: RealtimeGateway) {}

  /** Outbox rows for `messages`, written with the caller's transaction manager. */
  async recordIn(
    manager: EntityManager,
    messages: ReadonlyArray<EventChangeMessage | null>,
  ): Promise<void> {
    await enqueueOutbox(
      manager,
      messages
        .filter((message): message is EventChangeMessage =>
          isUuid(message?.tenantId),
        )
        .map((message) => ({
          tenantId: message.tenantId,
          aggregateType: 'production_event',
          aggregateId: message.eventId,
          type: changeTypeOf(message),
          version: message.revision,
          payload: { ...message },
        })),
    );
  }

  eventChanged(message: EventChangeMessage): void {
    this.publish('EventChanged', message);
  }

  eventRetracted(message: EventChangeMessage): void {
    this.publish('EventRetracted', message);
  }

  /**
   * v1 clients refetch on `productionEventUpdated`; used for changes that bypass ProductionEventService.
   * Sent to the tenant's (and unit's) rooms only (plan 3.11).
   */
  legacyUpdated(
    eventId: string,
    tenantId: string,
    unitId?: string | null,
  ): void {
    this.gateway.broadcastProductionEventUpdated(
      { id: eventId },
      { tenantId, unitId },
    );
  }

  private publish(type: EventChangeType, message: EventChangeMessage): void {
    this.logger.debug(
      `${type} ${message.eventId} r${message.revision} (${message.kind})`,
    );
    const name = type === 'EventChanged' ? 'Changed' : 'Retracted';
    this.gateway.broadcastEntityEvent(name, 'productionEvent', {
      type,
      ...message,
    });
  }
}

/** A retraction revision is `EventRetracted`; every other revision is `EventChanged`. */
export function changeTypeOf(message: EventChangeMessage): EventChangeType {
  return message.kind === 'retraction' ? 'EventRetracted' : 'EventChanged';
}

/** Message for a revision that moved an event from `before` to `after`. */
export function changeMessage(
  before: ProductionEvent,
  after: ProductionEvent,
  revision: number,
  kind: RevisionKind,
): EventChangeMessage {
  return {
    tenantId: after.tenantId ?? '',
    eventId: after.id,
    unitId: after.unitId ?? null,
    revision,
    ...affectedWindow(before, after),
    kind,
  };
}

/** Interval touched by a change: earliest start to latest end (null when either side is open). */
export function affectedWindow(
  before: { startTime: Date; endTime?: Date | null },
  after: { startTime: Date; endTime?: Date | null },
): { affectedFrom: string; affectedTo: string | null } {
  const starts = [before.startTime, after.startTime].map((value) =>
    new Date(value).getTime(),
  );
  const ends = [before.endTime, after.endTime];
  const open = ends.some((value) => value === null || value === undefined);
  return {
    affectedFrom: new Date(Math.min(...starts)).toISOString(),
    affectedTo: open
      ? null
      : new Date(
          Math.max(...ends.map((value) => new Date(value as Date).getTime())),
        ).toISOString(),
  };
}
