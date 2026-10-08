import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { randomUUID } from 'crypto';
import { ProductionEvent } from './production-event.entity';
import { RealtimeGateway } from '../realtime.gateway';
import { CreateProductionEventDto } from './dto/create-production-event.dto';
import { UpdateProductionEventDto } from './dto/update-production-event.dto';
import { ProductionEventQueryDto } from './dto/production-event-query.dto';
import { RcaAutoCreateService } from '../rca/rca-auto-create.service';
import { PagedResult } from '../common/dto/paged-result';
import { applyProductionEventFilters } from './production-event-query.builder';
import { prepareCreate, prepareUpdate } from './event-write-model';
import { getRequestContext } from '../common/context/request-context';
import { EventRevisionService } from './revisions/event-revision.service';
import { actorFromContext, RevisionActor } from './revisions/revision-actor';

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
  private readonly logger = new Logger(ProductionEventService.name);

  constructor(
    @InjectRepository(ProductionEvent)
    private readonly eventRepository: Repository<ProductionEvent>,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly rcaAutoCreateService: RcaAutoCreateService,
    private readonly revisions: EventRevisionService,
  ) {}

  findAll(): Promise<ProductionEvent[]> {
    return this.search({});
  }

  findOne(id: string): Promise<ProductionEvent | null> {
    return this.eventRepository.findOne({
      where: { id },
      relations: [...EVENT_RELATIONS],
    });
  }

  /** AND-combined filters, newest first. */
  search(query: ProductionEventQueryDto): Promise<ProductionEvent[]> {
    return this.buildSearch(query).getMany();
  }

  async searchPage(
    query: ProductionEventQueryDto,
  ): Promise<PagedResult<ProductionEvent>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const [items, total] = await this.buildSearch(query)
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { items, total, page, pageSize };
  }

  /**
   * v1 create. Interval, classification, states, `status` and the legacy `duration` (minutes) are
   * derived server-side by the write model; the client's `status` is translated and its `duration`
   * ignored (B8, DT11). Interval violations are 422. Revision 1 is recorded in the same transaction
   * (plan 1.2); `actor` defaults to the request's user (connectors pass their own).
   */
  async create(
    data: CreateProductionEventDto,
    actor: RevisionActor = actorFromContext(getRequestContext()),
  ): Promise<ProductionEvent> {
    const id = randomUUID();
    const fields = withoutClientDuration(data);
    const event = this.eventRepository.create({
      ...fields,
      id,
      canonicalId: id,
      ...prepareCreate(data),
    } as Partial<ProductionEvent>);
    const result = await this.revisions.createEvent(event, actor);
    await this.publishCreated(result);
    return result;
  }

  /** Side effects of every new event, v1 or v2: realtime push and the RCA trigger rules. */
  async publishCreated(event: ProductionEvent): Promise<void> {
    this.realtimeGateway.broadcastEntityEvent(
      'Created',
      'productionEvent',
      event,
    );
    this.realtimeGateway.broadcastProductionEventCreated(event);
    try {
      const autoRca = await this.rcaAutoCreateService.tryCreateForEvent(event);
      if (autoRca.created) {
        this.logger.log(
          `RCA auto-created for event ${event.id}: ${autoRca.rcaId}`,
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `RCA auto-create skipped for event ${event.id}: ${message}`,
      );
    }
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
  ): Promise<ProductionEvent | null> {
    const fields = withoutClientDuration(data);
    const changed = await this.revisions.applyUserChange({
      actor: actorFromContext(getRequestContext()),
      eventId: id,
      patch: (existing) =>
        ({
          ...fields,
          ...prepareUpdate(existing, data),
        }) as Partial<ProductionEvent>,
    });
    if (!changed) {
      return null;
    }
    const updated = await this.findOne(id);
    if (updated) {
      this.publishUpdated(updated);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const event = await this.findOne(id);
    await this.eventRepository.delete(id);
    if (event) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'productionEvent', {
        id,
      });
    }
  }

  private buildSearch(
    query: ProductionEventQueryDto,
  ): SelectQueryBuilder<ProductionEvent> {
    const qb = this.eventRepository.createQueryBuilder('event');
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
