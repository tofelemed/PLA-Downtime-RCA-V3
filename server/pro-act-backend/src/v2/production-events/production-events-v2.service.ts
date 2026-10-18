import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { EventRevision } from '../../production-event/revisions/event-revision.entity';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
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
import { ProductionEventExportQueryDto } from './production-event-export-query.dto';
import { EventCsv, exportEventsCsv } from './production-events-export';
import { EventSelectionView, selectEvents } from './production-event-selection';
import { applyEventOrder, cursorOf } from './production-event-sort';
import { sourceOwnedFields } from './source-owned-fields';
import { withAccountingStates } from './event-accounting-states';
import { withIncidentIds } from '../stop-events/event-incidents';

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
    @InjectRepository(EventRevision)
    private readonly revisions: Repository<EventRevision>,
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

    const asOf = new Date();
    const qb = scopedQuery(this.events, 'event', {
      unitProperty: 'unitId',
      context,
    });
    applyProductionEventV2Filters(qb, query, 'event', asOf);
    applyKeysetCursor(qb, query.cursor, sort);
    applyEventOrder(qb, sort).take(query.limit + 1);

    const rows = await qb.getMany();
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? cursorOf(last, sort.field) : null;

    const tenantId = requireTenantId(context);
    const views = await withIncidentIds(
      this.events.manager,
      tenantId,
      page.map((event) => toProductionEventV2View(event, asOf)),
    );
    return listResponse(
      await withAccountingStates(this.events.manager, tenantId, views),
      nextCursor,
      { tenantId },
      asOf,
    );
  }

  /** The filtered events as a versioned snapshot for an "all matching" bulk action (SME D13). */
  selection(
    context: RequestContext,
    query: ProductionEventExportQueryDto,
  ): Promise<EventSelectionView> {
    return selectEvents(this.events, context, query);
  }

  /** CSV of the filtered list (same scoped query and filters; window required, ≤ 50,000 rows). */
  exportCsv(
    context: RequestContext,
    query: ProductionEventExportQueryDto,
  ): Promise<EventCsv> {
    return exportEventsCsv(this.events, context, query);
  }

  /**
   * One event of the caller's scope with its source layer (latest source facts, overridden fields); a
   * foreign or unknown id is the same 404 (no existence leak).
   */
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
    const source = await scopedQuery(this.revisions, 'rev', { context })
      .andWhere('rev.eventId = :id AND rev.kind = :kind', {
        id,
        kind: 'source',
      })
      .orderBy('rev.revision', 'DESC')
      .getOne();
    const tenantId = requireTenantId(context);
    const [view] = await withAccountingStates(
      this.events.manager,
      tenantId,
      await withIncidentIds(this.events.manager, tenantId, [
        toProductionEventV2View(event, new Date()),
      ]),
    );
    return {
      ...view,
      sourceFacts: source?.sourceFacts ?? null,
      overriddenFields: Object.keys(event.userOverrides ?? {}),
      sourceOwnedFields: sourceOwnedFields(event),
    };
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
