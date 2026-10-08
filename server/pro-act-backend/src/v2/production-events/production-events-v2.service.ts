import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { CursorCodec } from '../common/cursor-codec';
import { listResponse, ListResponse } from '../common/response';
import { parseSort, SortSpec } from '../common/sort-spec';
import {
  PRODUCTION_EVENT_SORT_FIELDS,
  ProductionEventListQueryDto,
  ProductionEventSortField,
} from './production-event-list-query.dto';
import {
  applyKeysetCursor,
  applyProductionEventV2Filters,
} from './production-event-v2.query';
import {
  ProductionEventV2View,
  toProductionEventV2View,
} from './production-event-v2.view';

const DEFAULT_SORT: SortSpec<ProductionEventSortField> = {
  field: 'startTime',
  direction: 'DESC',
};

/**
 * Reference v2 read model: tenant from identity, AND-combined filters, overlap window and keyset paging
 * over the existing entity. The interval-model redesign (1.1) will swap the entity, not this contract.
 */
@Injectable()
export class ProductionEventsV2Service {
  constructor(
    @InjectRepository(ProductionEvent)
    private readonly events: Repository<ProductionEvent>,
  ) {}

  async list(
    tenantId: string,
    query: ProductionEventListQueryDto,
  ): Promise<ListResponse<ProductionEventV2View>> {
    assertWindow(query.from, query.to);
    const sort = parseSort(
      query.sort,
      PRODUCTION_EVENT_SORT_FIELDS,
      DEFAULT_SORT,
    );

    const qb = this.events
      .createQueryBuilder('event')
      .where('event.tenantId = :tenantId', { tenantId });
    applyProductionEventV2Filters(qb, query);
    applyKeysetCursor(qb, query.cursor, sort);
    qb.orderBy(`event.${sort.field}`, sort.direction)
      .addOrderBy('event.id', sort.direction)
      .take(query.limit + 1);

    const rows = await qb.getMany();
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? CursorCodec.encode({
            sortValue: last.startTime.toISOString(),
            id: last.id,
          })
        : null;

    return listResponse(page.map(toProductionEventV2View), nextCursor, {
      tenantId,
    });
  }
}

function assertWindow(from?: string, to?: string): void {
  if (from && to && new Date(from).getTime() >= new Date(to).getTime()) {
    throw new UnprocessableEntityException({
      code: 'INVALID_RANGE',
      message: ['from must be earlier than to'],
      fieldErrors: [{ field: 'from', message: 'from must be earlier than to' }],
    });
  }
}
