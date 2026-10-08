import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import { ProductionEvent } from '../production-event.entity';
import {
  changeMessage,
  EventChangeMessage,
  EventChangeNotifier,
} from './event-change.notifier';
import {
  EventFacts,
  factsOf,
  normalizeFacts,
  SOURCE_ATTRIBUTE_FACTS,
  SOURCE_FIELDS,
} from './event-facts';
import { EventReviewItem } from './event-review-item.entity';
import { isUuid, RevisionActor } from './revision-actor';
import {
  appendCoding,
  appendRevision,
  codingFactsOf,
  hasRevisionTenant,
  lockEvent,
} from './revision-store';
import { ReviewDecision, resolveIn } from './review-resolution';
import {
  applySourceIn,
  retractIn,
  RevisionResult,
  SourceOutcome,
  SourceProvenance,
} from './source-revision';
import { applyUserChangeIn, UserChange } from './user-change';

/**
 * Plan 1.2 (ING01, ING06, §5.3, §14.2): every write to a production event after creation is a revision.
 * Source facts, user coding and the effective event are separate layers; a source refresh never resets
 * coding, RCA or workflow state (B5/I1). Each operation runs in one transaction with the event row
 * locked (`SELECT ... FOR UPDATE`); change messages are published after commit.
 */
@Injectable()
export class EventRevisionService {
  private readonly logger = new Logger(EventRevisionService.name);

  constructor(
    @InjectRepository(ProductionEvent)
    private readonly events: Repository<ProductionEvent>,
    private readonly notifier: EventChangeNotifier,
  ) {}

  /**
   * Inserts a new event together with its revision 1 and baseline coding revision 1. `attributeFacts`
   * are the typed source attributes without a column (plan 1.3), kept in revision 1's source facts.
   */
  async createEvent(
    event: ProductionEvent,
    actor: RevisionActor,
    attributeFacts: EventFacts = {},
  ): Promise<ProductionEvent> {
    const tracked = isUuid(event.tenantId);
    event.currentSourceRevision =
      tracked && event.sourceKind !== 'manual' ? 1 : 0;
    event.currentCodingRevision = tracked ? 1 : 0;
    const { result, message } = await this.inTransaction(async (manager) => {
      const saved = await manager.save(ProductionEvent, event);
      return {
        result: saved,
        message: await this.recordCreated(
          saved,
          actor,
          manager,
          attributeFacts,
        ),
      };
    });
    this.publish(message);
    return result;
  }

  /**
   * Revision 1 (`user` for manual events, `source` otherwise) and coding revision 1 ('baseline') of an
   * event inserted in the same transaction. Events without a uuid tenant keep no revisions.
   */
  async recordCreated(
    event: ProductionEvent,
    actor: RevisionActor,
    manager: EntityManager,
    attributeFacts: EventFacts = {},
  ): Promise<EventChangeMessage | null> {
    const locked = await lockEvent(manager, event.id);
    if (!locked || !hasRevisionTenant(locked)) {
      this.logger.warn(
        `Event ${event.id} has no uuid tenant; no revisions kept`,
      );
      return null;
    }
    const kind = locked.sourceKind === 'manual' ? 'user' : 'source';
    await appendRevision(manager, locked, {
      revision: 1,
      kind,
      actor,
      sourceFacts:
        kind === 'source'
          ? {
              ...factsOf(locked, SOURCE_FIELDS),
              ...normalizeFacts(attributeFacts, SOURCE_ATTRIBUTE_FACTS),
            }
          : null,
      changeReason: 'created',
    });
    await appendCoding(manager, locked, {
      revision: 1,
      actor,
      oldValues: {},
      newValues: codingFactsOf(locked),
      reason: 'baseline',
      overridesSourceRevision: null,
    });
    return changeMessage(locked, locked, 1, kind);
  }

  /** A connector delivered `rawFacts` for an existing event: duplicate, or a new source revision. */
  async applySourceRevision(
    eventId: string,
    rawFacts: Readonly<Record<string, unknown>>,
    provenance: SourceProvenance,
  ): Promise<SourceOutcome> {
    const { result, message } = await this.inTransaction((manager) =>
      applySourceIn(manager, eventId, rawFacts, provenance),
    );
    this.publish(message, true);
    return result;
  }

  /** Central path of user edits (v1 PUT, v2 PATCH); null when the event is not found. */
  async applyUserChange(change: UserChange): Promise<ProductionEvent | null> {
    const { result, message } = await this.inTransaction((manager) =>
      applyUserChangeIn(manager, change),
    );
    this.publish(message);
    return result;
  }

  /** Tombstones the event (never deletes); idempotent for an already retracted event. */
  async retract(
    eventId: string,
    actor: RevisionActor,
    reason: string,
    sourceRevision?: string,
  ): Promise<ProductionEvent> {
    const { result, message } = await this.inTransaction((manager) =>
      retractIn(manager, eventId, { actor, reason, sourceRevision }),
    );
    if (message) {
      this.notifier.eventRetracted(message);
      this.notifier.legacyUpdated(message.eventId);
    }
    return result;
  }

  /** Resolves an open review item of the caller's scope (404 for foreign items). */
  async resolveReviewItem(
    context: RequestContext,
    itemId: string,
    decision: ReviewDecision,
  ): Promise<EventReviewItem> {
    const { result, message } = await this.inTransaction((manager) =>
      resolveIn(manager, context, itemId, decision),
    );
    this.publish(message, true);
    return result;
  }

  /** Runs `work` and writes its change message to the outbox in the same transaction (plan 1.5). */
  private inTransaction<T>(
    work: (manager: EntityManager) => Promise<RevisionResult<T>>,
  ): Promise<RevisionResult<T>> {
    return this.events.manager.transaction(async (manager) => {
      const outcome = await work(manager);
      await this.notifier.recordIn(manager, [outcome.message]);
      return outcome;
    });
  }

  /** `legacyRefresh`: the change bypassed ProductionEventService, so v1 clients are told here. */
  private publish(
    message: EventChangeMessage | null,
    legacyRefresh = false,
  ): void {
    if (!message) return;
    this.notifier.eventChanged(message);
    if (legacyRefresh) this.notifier.legacyUpdated(message.eventId);
  }
}
