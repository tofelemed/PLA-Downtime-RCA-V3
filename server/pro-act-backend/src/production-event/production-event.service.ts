import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { randomUUID } from 'crypto';
import { ProductionEvent } from './production-event.entity';
import { RealtimeGateway } from '../realtime.gateway';
import { CreateProductionEventDto } from './dto/create-production-event.dto';
import { UpdateProductionEventDto } from './dto/update-production-event.dto';
import { ProductionEventQueryDto } from './dto/production-event-query.dto';
import { PagedResult } from '../common/dto/paged-result';
import { applyProductionEventFilters } from './production-event-query.builder';
import { prepareCreate, prepareUpdate } from './event-write-model';
import { getRequestContext } from '../common/context/request-context';
import { EventRevisionService } from './revisions/event-revision.service';
import { actorFromContext, RevisionActor } from './revisions/revision-actor';
import { EventFacts } from './revisions/event-facts';
import { ShiftLabelsService } from '../calendar/shift-labels.service';
import { findOrThrow } from '../common/helpers/find-or-throw';

/** Relations loaded on every read; `reasonCode` and `rca` were dropped at some point (B17) and are back. */
const EVENT_RELATIONS = [
  'plan',
  'unit',
  'asset',
  'impactCode',
  'oeeCode',
  'reasonCode',
  'rca',
] as const;
const DEFAULT_PAGE_SIZE = 50;

@Injectable()
export class ProductionEventService {
  constructor(
    @InjectRepository(ProductionEvent)
    private readonly eventRepository: Repository<ProductionEvent>,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly revisions: EventRevisionService,
    private readonly shiftLabels: ShiftLabelsService,
  ) {}

  /** v1 reads label `shift` from the generated shift instance (plan 2.1 step 5), not the stored text. */
  async findOne(id: string): Promise<ProductionEvent | null> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: [...EVENT_RELATIONS],
    });
    if (!event) return null;
    const [labelled] = await this.shiftLabels.apply([event]);
    return labelled;
  }

  /** AND-combined filters, newest first, one page (default 50 rows, at most 200). */
  async searchPage(
    query: ProductionEventQueryDto,
  ): Promise<PagedResult<ProductionEvent>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const [items, total] = await this.buildSearch(query)
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return {
      items: await this.shiftLabels.apply(items),
      total,
      page,
      pageSize,
    };
  }

  /**
   * v1 create. Interval, classification, states, `status` and the legacy `duration` (minutes) are
   * derived server-side by the write model; the client's `status` is translated and its `duration`
   * ignored (B8, DT11). Interval violations are 422. Revision 1 is recorded in the same transaction
   * (plan 1.2); `actor` defaults to the request's user (connectors pass their own, together with the
   * typed attribute facts that have no column, plan 1.3).
   */
  async create(
    data: CreateProductionEventDto,
    actor: RevisionActor = actorFromContext(getRequestContext()),
    attributeFacts: EventFacts = {},
  ): Promise<ProductionEvent> {
    const id = randomUUID();
    const fields = withoutClientDuration(data);
    const event = this.eventRepository.create({
      ...fields,
      id,
      canonicalId: id,
      ...prepareCreate(data),
    } as Partial<ProductionEvent>);
    const result = await this.revisions.createEvent(
      event,
      actor,
      attributeFacts,
    );
    await this.publishCreated(result);
    return result;
  }

  /**
   * Side effect of every new event, v1 or v2: realtime push. RCA triggers follow the `rca_policy` through
   * the outbox `EventChanged` consumer (RCA is v2 for every plant; the v1 trigger configs are retired).
   */
  publishCreated(event: ProductionEvent): Promise<void> {
    this.realtimeGateway.broadcastEntityEvent(
      'Created',
      'productionEvent',
      event,
    );
    this.realtimeGateway.broadcastProductionEventCreated(event);
    return Promise.resolve();
  }

  /** Realtime push after an update from any API version. */
  publishUpdated(event: ProductionEvent): void {
    this.realtimeGateway.broadcastEntityEvent(
      'Updated',
      'productionEvent',
      event,
    );
    this.realtimeGateway.broadcastProductionEventUpdated(event);
  }

  /** v1 update: a user change with coding/effective revisions and source overrides (plan 1.2). */
  async update(
    id: string,
    data: UpdateProductionEventDto,
  ): Promise<ProductionEvent> {
    const fields = withoutClientDuration(data);
    await findOrThrow(
      this.revisions.applyUserChange({
        actor: actorFromContext(getRequestContext()),
        eventId: id,
        patch: (existing) =>
          ({
            ...fields,
            ...prepareUpdate(existing, data),
          }) as Partial<ProductionEvent>,
      }),
      'ProductionEvent',
      id,
    );
    const updated = await findOrThrow(this.findOne(id), 'ProductionEvent', id);
    this.publishUpdated(updated);
    return updated;
  }

  /**
   * v1 delete (DB-03): the event is retracted — a tombstone with a retraction revision, as the v2 retract —
   * never deleted, so its revision history and the ledgers' evidence stay reproducible. v1 lists hide it.
   */
  async remove(id: string): Promise<void> {
    const event = await findOrThrow(this.findOne(id), 'ProductionEvent', id);
    await this.revisions.retract(
      id,
      actorFromContext(getRequestContext()),
      'deleted through the v1 API',
    );
    if (event.tenantId) {
      this.realtimeGateway.broadcastEntityEvent(
        'Deleted',
        'productionEvent',
        { id },
        { tenantId: event.tenantId, unitId: event.unitId },
      );
    }
  }

  private buildSearch(
    query: ProductionEventQueryDto,
  ): SelectQueryBuilder<ProductionEvent> {
    const qb = this.eventRepository
      .createQueryBuilder('event')
      .where(`event.physicalState <> 'retracted'`);
    for (const relation of EVENT_RELATIONS) {
      qb.leftJoinAndSelect(`event.${relation}`, relation);
    }
    applyProductionEventFilters(qb, query);
    return qb.orderBy('event.startTime', 'DESC').addOrderBy('event.id', 'DESC');
  }
}

/** v1 clients send a browser-computed `duration`; the server derives it from the interval (B8). */
function withoutClientDuration<T extends { duration?: number }>(
  data: T,
): Omit<T, 'duration'> {
  const copy = { ...data };
  delete copy.duration;
  return copy;
}
