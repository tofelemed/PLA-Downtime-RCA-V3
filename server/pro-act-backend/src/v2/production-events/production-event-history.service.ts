import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { EventCoding } from '../../production-event/revisions/event-coding.entity';
import { EventReviewItem } from '../../production-event/revisions/event-review-item.entity';
import { EventRevision } from '../../production-event/revisions/event-revision.entity';
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
  ) {}

  async history(
    context: RequestContext,
    eventId: string,
  ): Promise<ProductionEventHistoryView> {
    const visible = await scopedQuery(this.events, 'event', {
      context,
      unitProperty: 'unitId',
    })
      .andWhere('event.id = :eventId', { eventId })
      .getCount();
    if (visible === 0) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    }
    const [revisions, coding, reviewItems] = await Promise.all([
      this.forEvent(this.revisions, context, eventId, 'revision'),
      this.forEvent(this.coding, context, eventId, 'revision'),
      this.forEvent(this.reviewItems, context, eventId, 'createdAt'),
    ]);
    return {
      revisions: revisions.map(toEventRevisionView),
      coding: coding.map(toEventCodingView),
      reviewItems: reviewItems.map(toEventReviewItemView),
    };
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
