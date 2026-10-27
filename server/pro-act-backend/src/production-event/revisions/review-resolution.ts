import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { activeCodingRulesIn } from '../../rules/active-coding-rules';
import { ProductionEvent } from '../production-event.entity';
import { EventChangeMessage } from './event-change.notifier';
import {
  DECLARED_REVIEW_KINDS,
  EventReviewItem,
  ReviewItemState,
} from './event-review-item.entity';
import { actorFromContext, RevisionActor } from './revision-actor';
import { latestSourceRevision, lockEvent, writeEvent } from './revision-store';
import { RevisionResult, retypes, sourceColumns } from './source-revision';
import { appendUserRevisions } from './user-change';

export const REVIEW_DECISIONS = [
  'keep_override',
  'accept_source',
  'dismiss',
] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

const ACCEPTED_SOURCE = 'accepted source value';
/** items whose field has a source value to accept (a conflict, or a close awaiting the source) */
const ACCEPTABLE_KINDS: readonly string[] = [
  'source_vs_override_conflict',
  'pending_source_confirmation',
];

/**
 * §5.3 decision on an open review item of the caller's tenant (and unit scope): keep the override, or
 * accept the latest source value (field written, override dropped, coding + effective revision).
 */
export async function resolveIn(
  manager: EntityManager,
  context: RequestContext,
  itemId: string,
  decision: ReviewDecision,
): Promise<RevisionResult<EventReviewItem>> {
  const item = await lockVisibleItem(manager, context, itemId);
  if (item.state !== 'open') {
    throw new ConflictException({
      code: 'REVIEW_ITEM_RESOLVED',
      message: `The review item is already ${item.state}`,
    });
  }
  assertDecisionAllowed(item, decision);
  const actor = actorFromContext(context);
  const message =
    decision === 'accept_source'
      ? await acceptSource(manager, item, actor)
      : null;
  item.state = STATE_OF_DECISION[decision];
  item.resolvedBy = actor.id;
  item.resolvedAt = new Date();
  item.updatedBy = actor.id;
  const result = await manager.getRepository(EventReviewItem).save(item);
  return { result, message };
}

const STATE_OF_DECISION: Record<ReviewDecision, ReviewItemState> = {
  keep_override: 'kept_override',
  accept_source: 'accepted_source',
  dismiss: 'dismissed',
};

/** `dismiss` is for the declared-figures kinds only; the other kinds keep keep_override / accept_source. */
function assertDecisionAllowed(
  item: EventReviewItem,
  decision: ReviewDecision,
): void {
  if (decision !== 'dismiss' || DECLARED_REVIEW_KINDS.includes(item.kind)) {
    return;
  }
  throw new UnprocessableEntityException({
    code: 'INVALID_DECISION',
    message: 'Only declared-figures items can be dismissed',
  });
}

async function lockVisibleItem(
  manager: EntityManager,
  context: RequestContext,
  itemId: string,
): Promise<EventReviewItem> {
  const item = await scopedQuery(
    manager.getRepository(EventReviewItem),
    'item',
    { context },
  )
    .andWhere('item.id = :itemId', { itemId })
    .setLock('pessimistic_write')
    .getOne();
  const visible =
    item &&
    (await scopedQuery(manager.getRepository(ProductionEvent), 'event', {
      context,
      unitProperty: 'unitId',
    })
      .andWhere('event.id = :eventId', { eventId: item.eventId })
      .getCount()) > 0;
  if (!item || !visible) {
    throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
  }
  return item;
}

async function acceptSource(
  manager: EntityManager,
  item: EventReviewItem,
  actor: RevisionActor,
): Promise<EventChangeMessage> {
  const field = item.field;
  const existing = await lockEvent(manager, item.eventId);
  if (!ACCEPTABLE_KINDS.includes(item.kind) || !field || !existing) {
    throw new UnprocessableEntityException({
      code: 'INVALID_DECISION',
      message:
        'Only source/override conflicts and pending closes can accept the source value',
    });
  }
  const source = await latestSourceRevision(manager, existing.id);
  const overrides = { ...(existing.userOverrides ?? {}) };
  delete overrides[field];
  const codingRevision = existing.currentCodingRevision + 1;
  const released = { ...existing, userOverrides: overrides };
  const facts = source?.sourceFacts ?? {};
  const rules = retypes(released, facts, [field])
    ? await activeCodingRulesIn(manager, existing.tenantId)
    : [];
  const updated = await writeEvent(manager, existing.id, {
    ...sourceColumns(released, facts, [field], rules),
    userOverrides: overrides,
    currentCodingRevision: codingRevision,
  });
  return appendUserRevisions(manager, existing, updated, {
    actor,
    fields: [field],
    reason: ACCEPTED_SOURCE,
    overridesSourceRevision: null,
  });
}
