import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { ProductionEvent } from '../production-event.entity';
import { EventChangeMessage } from './event-change.notifier';
import { EventReviewItem } from './event-review-item.entity';
import { actorFromContext, RevisionActor } from './revision-actor';
import { latestSourceRevision, lockEvent, writeEvent } from './revision-store';
import { RevisionResult, sourceColumns } from './source-revision';
import { appendUserRevisions } from './user-change';

export const REVIEW_DECISIONS = ['keep_override', 'accept_source'] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

const ACCEPTED_SOURCE = 'accepted source value';

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
  const actor = actorFromContext(context);
  const message =
    decision === 'accept_source'
      ? await acceptSource(manager, item, actor)
      : null;
  item.state =
    decision === 'accept_source' ? 'accepted_source' : 'kept_override';
  item.resolvedBy = actor.id;
  item.resolvedAt = new Date();
  item.updatedBy = actor.id;
  const result = await manager.getRepository(EventReviewItem).save(item);
  return { result, message };
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
  if (item.kind !== 'source_vs_override_conflict' || !field || !existing) {
    throw new UnprocessableEntityException({
      code: 'INVALID_DECISION',
      message: 'Only source/override conflicts can accept the source value',
    });
  }
  const source = await latestSourceRevision(manager, existing.id);
  const overrides = { ...(existing.userOverrides ?? {}) };
  delete overrides[field];
  const codingRevision = existing.currentCodingRevision + 1;
  const updated = await writeEvent(manager, existing.id, {
    ...sourceColumns(
      { ...existing, userOverrides: overrides } as ProductionEvent,
      source?.sourceFacts ?? {},
      [field],
    ),
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
