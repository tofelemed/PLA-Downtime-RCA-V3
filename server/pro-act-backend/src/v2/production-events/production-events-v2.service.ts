import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductionEvent } from '../../production-event/production-event.entity';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
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
 * v2 event reads: tenant and scope from identity, AND-combined filters (classification and state axes
 * included), overlap window, keyset paging; durations in seconds, open events with elapsed time.
 */
@Injectable()
export class ProductionEventsV2Service {
  constructor(
    @InjectRepository(ProductionEvent)
    private readonly events: Repository<ProductionEvent>,
  ) {}

  async list(
    context: RequestContext,
    query: ProductionEventListQueryDto,
  ): Promise<ListResponse<ProductionEventV2View>> {
    assertWindow(query.from, query.to);
    const sort = parseSort(
      query.sort,
      PRODUCTION_EVENT_SORT_FIELDS,
      DEFAULT_SORT,
    );

    const qb = scopedQuery(this.events, 'event', {
      unitProperty: 'unitId',
      context,
    });
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

    const asOf = new Date();
    return listResponse(
      page.map((event) => toProductionEventV2View(event, asOf)),
      nextCursor,
      {
        tenantId: requireTenantId(context),
      },
      asOf,
    );
  }

  /** One event of the caller's scope; a foreign or unknown id is the same 404 (no existence leak). */
  async get(
    context: RequestContext,
    id: string,
  ): Promise<ProductionEventV2View> {
    const event = await scopedQuery(this.events, 'event', {
      unitProperty: 'unitId',
      context,
    })
      .andWhere('event.id = :id', { id })
      .getOne();
    if (!event) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    }
    return toProductionEventV2View(event, new Date());
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
