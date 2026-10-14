import { UnprocessableEntityException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { MAX_BULK_ITEMS } from './event-operations-v2.dto';
import { ProductionEventExportQueryDto } from './production-event-export-query.dto';
import { assertExportWindow } from './production-events-export';
import { applyProductionEventV2Filters } from './production-event-v2.query';

/** One selected event with the version it had when the selection was taken. */
export interface SelectedEventView {
  id: string;
  rowVersion: number;
  unitId: string;
  assetId: string | null;
  startTime: string;
  endTime: string | null;
}

/** `GET /v2/production-events/selection`: what an "all matching" bulk action would touch (SME D13). */
export interface EventSelectionView {
  count: number;
  /** earliest start and latest end of the selected events (null end = one is still open) */
  firstStart: string | null;
  lastEnd: string | null;
  unitIds: string[];
  assetCount: number;
  /** the snapshot: bulk coding sends these ids with these versions, so later changes are refused */
  items: SelectedEventView[];
}

const toItem = (event: ProductionEvent): SelectedEventView => ({
  id: event.id,
  rowVersion: event.rowVersion,
  unitId: event.unitId,
  assetId: event.assetId ?? null,
  startTime: event.startTime.toISOString(),
  endTime: event.endTime ? event.endTime.toISOString() : null,
});

function summaryOf(items: readonly SelectedEventView[]): EventSelectionView {
  const starts = items.map((item) => item.startTime).sort();
  const open = items.some((item) => item.endTime === null);
  const ends = items.flatMap((item) => (item.endTime ? [item.endTime] : [])).sort();
  return {
    count: items.length,
    firstStart: starts[0] ?? null,
    lastEnd: open ? null : (ends[ends.length - 1] ?? null),
    unitIds: [...new Set(items.map((item) => item.unitId))].sort(),
    assetCount: new Set(items.flatMap((item) => (item.assetId ? [item.assetId] : []))).size,
    items: [...items],
  };
}

/**
 * The events matching the list filters in the caller's scope, as a versioned snapshot for an explicit
 * "all matching" bulk action (SME D13): the window is required (≤ 400 days, like the export) and more than
 * the bulk limit is refused (422 SELECTION_TOO_LARGE) instead of silently cut.
 */
export async function selectEvents(
  repo: Repository<ProductionEvent>,
  context: RequestContext,
  query: ProductionEventExportQueryDto,
): Promise<EventSelectionView> {
  assertExportWindow(query);
  const qb = scopedQuery(repo, 'event', { unitProperty: 'unitId', context });
  const rows = await applyProductionEventV2Filters(qb, query)
    .select(['event.id', 'event.rowVersion', 'event.unitId', 'event.assetId', 'event.startTime', 'event.endTime'])
    .orderBy('event.startTime', 'ASC')
    .addOrderBy('event.id', 'ASC')
    .take(MAX_BULK_ITEMS + 1)
    .getMany();
  if (rows.length > MAX_BULK_ITEMS) {
    const message = `more than ${MAX_BULK_ITEMS} events match; narrow the filters or the window`;
    throw new UnprocessableEntityException({ code: 'SELECTION_TOO_LARGE', message: [message] });
  }
  return summaryOf(rows.map(toItem));
}
