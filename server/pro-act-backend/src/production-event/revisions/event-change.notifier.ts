import { Injectable, Logger } from '@nestjs/common';
import { RealtimeGateway } from '../../realtime.gateway';
import { ProductionEvent } from '../production-event.entity';
import { RevisionKind } from './event-revision.entity';

/**
 * Payload of the future `EventChanged` / `EventRetracted` outbox messages (spec API05 §15.4, plan 1.5):
 * the affected interval lets Phase 2 recalculate only the periods it touches. `affectedTo` is null
 * while the event is (or was) open.
 */
export interface EventChangeMessage {
  tenantId: string;
  eventId: string;
  /** `event_revisions.revision` that caused the message */
  revision: number;
  affectedFrom: string;
  affectedTo: string | null;
  kind: RevisionKind;
}

export type EventChangeType = 'EventChanged' | 'EventRetracted';

/**
 * Domain-event seam for event revisions. Until the outbox lands (1.5) messages are broadcast over the
 * realtime gateway (`productionEventChanged` / `productionEventRetracted`).
 */
@Injectable()
export class EventChangeNotifier {
  private readonly logger = new Logger(EventChangeNotifier.name);

  constructor(private readonly gateway: RealtimeGateway) {}

  eventChanged(message: EventChangeMessage): void {
    this.publish('EventChanged', message);
  }

  eventRetracted(message: EventChangeMessage): void {
    this.publish('EventRetracted', message);
  }

  /** v1 clients refetch on `productionEventUpdated`; used for changes that bypass ProductionEventService. */
  legacyUpdated(eventId: string): void {
    this.gateway.broadcastProductionEventUpdated({ id: eventId });
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

/** Message for a revision that moved an event from `before` to `after`. */
export function changeMessage(
  before: ProductionEvent,
  after: ProductionEvent,
  revision: number,
  kind: RevisionKind,
): EventChangeMessage {
  return {
    tenantId: after.tenantUuid ?? after.tenantId ?? '',
    eventId: after.id,
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
