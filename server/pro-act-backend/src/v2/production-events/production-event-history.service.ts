import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { EventCoding } from '../../production-event/revisions/event-coding.entity';
import { EventReviewItem } from '../../production-event/revisions/event-review-item.entity';
import { EventRevision } from '../../production-event/revisions/event-revision.entity';
import { EventRelation } from '../../event-operations/event-relation.entity';
import { toEventRelationView } from './event-operation.view';
import {
  ProductionEventHistoryView,
  toEventCodingView,
  toEventReviewItemView,
  toEventRevisionView,
} from './production-event-history.view';

/** Upper bound per list; an event carries a handful of revisions, this only guards pathological rows. */
const HISTORY_LIMIT = 500;

/** Revision history of one event in the caller's scope (spec §14.2, ING06 provenance). */
@Injectable()
export class ProductionEventHistoryService {
  constructor(
    @InjectRepository(ProductionEvent)
    private readonly events: Repository<ProductionEvent>,
    @InjectRepository(EventRevision)
    private readonly revisions: Repository<EventRevision>,
    @InjectRepository(EventCoding)
    private readonly coding: Repository<EventCoding>,
    @InjectRepository(EventReviewItem)
    private readonly reviewItems: Repository<EventReviewItem>,
    @InjectRepository(EventRelation)
    private readonly relations: Repository<EventRelation>,
  ) {}

  async history(
    context: RequestContext,
    eventId: string,
  ): Promise<ProductionEventHistoryView> {
    const event = await scopedQuery(this.events, 'event', {
      context,
      unitProperty: 'unitId',
    })
      .select(['event.id', 'event.sourceKind', 'event.source'])
      .andWhere('event.id = :eventId', { eventId })
      .getOne();
    if (!event) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    }
    const origin = {
      sourceKind: event.sourceKind ?? null,
      source: event.source ?? null,
    };
    const [revisions, coding, reviewItems, relations] = await Promise.all([
      this.forEvent(this.revisions, context, eventId, 'revision'),
      this.forEvent(this.coding, context, eventId, 'revision'),
      this.forEvent(this.reviewItems, context, eventId, 'createdAt'),
      this.lineage(context, eventId),
    ]);
    return {
      revisions: revisions.map((row) => toEventRevisionView(row, origin)),
      coding: coding.map((row) => toEventCodingView(row, origin)),
      reviewItems: reviewItems.map(toEventReviewItemView),
      relations: relations.map(toEventRelationView),
    };
  }

  /** Relations where the event is either end (DT09 lineage). */
  private lineage(
    context: RequestContext,
    eventId: string,
  ): Promise<EventRelation[]> {
    return scopedQuery(this.relations, 'row', { context })
      .andWhere('(row.fromEventId = :eventId OR row.toEventId = :eventId)', {
        eventId,
      })
      .orderBy('row.createdAt', 'ASC')
      .addOrderBy('row.id', 'ASC')
      .take(HISTORY_LIMIT)
      .getMany();
  }

  private forEvent<T extends ObjectLiteral>(
    repository: Repository<T>,
    context: RequestContext,
    eventId: string,
    orderBy: string,
  ): Promise<T[]> {
    return scopedQuery(repository, 'row', { context })
      .andWhere('row.eventId = :eventId', { eventId })
      .orderBy(`row.${orderBy}`, 'ASC')
      .addOrderBy('row.id', 'ASC')
      .take(HISTORY_LIMIT)
      .getMany();
  }
}
