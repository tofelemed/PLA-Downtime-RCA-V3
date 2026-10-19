import { canViewMoney } from '../../auth/money/money-access';
import { UnprocessableEntityException } from '@nestjs/common';
import { Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { durationSeconds } from '../../domain/time/interval-algebra';
import { CSV_BOM, csvRow, CsvValue } from '../../exports/csv';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { CursorCodec } from '../common/cursor-codec';
import { toDecimalString } from '../common/decimal-string.transformer';
import { SortSpec } from '../common/sort-spec';
import { ProductionEventExportQueryDto } from './production-event-export-query.dto';
import { ProductionEventSortField } from './production-event-list-query.dto';
import {
  EXPORT_LABEL_COLUMNS,
  exportTimezoneOf,
  labelCells,
} from './production-events-export-labels';
import {
  applyKeysetCursor,
  applyProductionEventV2Filters,
} from './production-event-v2.query';

export const EXPORT_MAX_ROWS = 50_000;
const BATCH = 1_000;
const MAX_DAYS = 400;
const DAY_MS = 86_400_000;
const NEWEST_FIRST: SortSpec<ProductionEventSortField> = {
  field: 'startTime',
  direction: 'DESC',
};

export const EXPORT_COLUMNS = [
  'start_utc',
  'end_utc',
  'duration_seconds',
  'unit',
  'asset',
  'event_type',
  'physical_type',
  'schedule_class',
  'oee_component',
  'reason_code',
  'reason',
  'physical_state',
  'coding_state',
  'rca_state',
  'severity',
  'source_kind',
  'description',
  'quantity',
  'quantity_uom',
  'cost',
  ...EXPORT_LABEL_COLUMNS,
] as const;

const SELECTED = [
  'id',
  'startTime',
  'endTime',
  'unitId',
  'assetId',
  'reasonCodeId',
  'eventType',
  'physicalType',
  'scheduleClass',
  'oeeComponent',
  'physicalState',
  'codingState',
  'rcaState',
  'severity',
  'sourceKind',
  'description',
  'quantity',
  'quantityUom',
  'cost',
].map((property) => `event.${property}`);

/** Names of the units, assets and reason codes of one batch (one query, tenant-guarded). */
interface Names {
  units: Map<string, string>;
  assets: Map<string, string>;
  reasons: Map<string, { code: string; name: string }>;
}

export interface EventCsv {
  filename: string;
  content: Buffer;
}

function rangeError(code: string, message: string) {
  return new UnprocessableEntityException({
    code,
    message: [message],
    fieldErrors: [{ field: 'from', message }],
  });
}

export function assertExportWindow(query: ProductionEventExportQueryDto): void {
  const span = new Date(query.to).getTime() - new Date(query.from).getTime();
  if (!(span > 0)) {
    throw rangeError('INVALID_RANGE', 'from must be earlier than to');
  }
  if (span > MAX_DAYS * DAY_MS) {
    throw rangeError(
      'WINDOW_TOO_LARGE',
      `export at most ${MAX_DAYS} days at once`,
    );
  }
}

function filtered(
  repo: Repository<ProductionEvent>,
  context: RequestContext,
  query: ProductionEventExportQueryDto,
) {
  const qb = scopedQuery(repo, 'event', { unitProperty: 'unitId', context });
  return applyProductionEventV2Filters(qb, query);
}

async function namesOf(
  repo: Repository<ProductionEvent>,
  tenantId: string,
  events: readonly ProductionEvent[],
): Promise<Names> {
  const ids = (pick: (e: ProductionEvent) => string | null | undefined) => [
    ...new Set(events.flatMap((e) => (pick(e) ? [pick(e) as string] : []))),
  ];
  const rows: Array<{ kind: string; id: string; name: string; code: string }> =
    await repo.manager.query(
      `SELECT 'unit' AS "kind", "id"::text AS "id", "name", "code" FROM "units"
        WHERE "id" = ANY($1::uuid[]) AND "tenant_id"::text = $4
       UNION ALL
       SELECT 'asset', "id"::text, "name", "code" FROM "assets"
        WHERE "id" = ANY($2::uuid[]) AND "tenant_id"::text = $4
       UNION ALL
       SELECT 'reason', "id"::text, "name", "code" FROM "reason_codes"
        WHERE "id" = ANY($3::uuid[]) AND "tenant_id"::text = $4`,
      [
        ids((e) => e.unitId),
        ids((e) => e.assetId),
        ids((e) => e.reasonCodeId),
        tenantId,
      ],
    );
  const of = (kind: string) => rows.filter((r) => r.kind === kind);
  return {
    units: new Map(of('unit').map((r) => [r.id, r.name])),
    assets: new Map(of('asset').map((r) => [r.id, r.name])),
    reasons: new Map(of('reason').map((r) => [r.id, r])),
  };
}

function recordOf(
  event: ProductionEvent,
  names: Names,
  timezone: string | null,
  showCost: boolean,
): CsvValue[] {
  const start = new Date(event.startTime);
  const end = event.endTime ? new Date(event.endTime) : null;
  const reason = event.reasonCodeId
    ? names.reasons.get(event.reasonCodeId)
    : undefined;
  const duration = end ? durationSeconds({ start, end }) : null;
  return [
    start.toISOString(),
    end?.toISOString() ?? null,
    duration === null ? null : String(duration),
    names.units.get(event.unitId) ?? null,
    event.assetId ? (names.assets.get(event.assetId) ?? null) : null,
    event.eventType ?? null,
    event.physicalType,
    event.scheduleClass,
    event.oeeComponent,
    reason?.code ?? null,
    reason?.name ?? null,
    event.physicalState,
    event.codingState,
    event.rcaState,
    event.severity ?? null,
    event.sourceKind,
    event.description ?? null,
    toDecimalString(event.quantity),
    event.quantityUom ?? null,
    // QA re-test 2026-10-19: the cost column stays in place, empty for a caller without the money capability
    showCost ? toDecimalString(event.cost) : null,
    ...labelCells(event, timezone),
  ];
}

async function nextBatch(
  repo: Repository<ProductionEvent>,
  context: RequestContext,
  query: ProductionEventExportQueryDto,
  after: ProductionEvent | undefined,
): Promise<ProductionEvent[]> {
  const cursor = after
    ? CursorCodec.encode({
        sortValue: new Date(after.startTime).toISOString(),
        id: after.id,
      })
    : undefined;
  const qb = filtered(repo, context, query).select(SELECTED);
  applyKeysetCursor(qb, cursor, NEWEST_FIRST);
  return qb
    .orderBy('event.startTime', 'DESC')
    .addOrderBy('event.id', 'DESC')
    .take(BATCH)
    .getMany();
}

/**
 * CSV of the filtered event list (v1 Event Hub "Export to CSV" parity): the list's scoped query and
 * filters, newest first, read in keyset batches of 1,000 with one name lookup per batch; at most 50,000
 * rows (counted first: 422 EXPORT_TOO_LARGE). Times ISO UTC, decimals as strings, names instead of ids; then
 * the plant-clock times and the screen labels of the keys (QA audit L5, `production-events-export-labels.ts`).
 */
export async function exportEventsCsv(
  repo: Repository<ProductionEvent>,
  context: RequestContext,
  query: ProductionEventExportQueryDto,
): Promise<EventCsv> {
  assertExportWindow(query);
  const tenantId = requireTenantId(context);
  if ((await filtered(repo, context, query).getCount()) > EXPORT_MAX_ROWS) {
    throw new UnprocessableEntityException({
      code: 'EXPORT_TOO_LARGE',
      message: 'More than 50,000 events match; narrow the filters',
    });
  }
  const timezone = await exportTimezoneOf(repo.manager, tenantId);
  const showCost = canViewMoney(context);
  const parts = [CSV_BOM + csvRow(EXPORT_COLUMNS)];
  let last: ProductionEvent | undefined;
  for (let read = 0; read < EXPORT_MAX_ROWS; ) {
    const batch = await nextBatch(repo, context, query, last);
    if (batch.length === 0) break;
    const names = await namesOf(repo, tenantId, batch);
    for (const event of batch)
      parts.push(csvRow(recordOf(event, names, timezone, showCost)));
    read += batch.length;
    last = batch[batch.length - 1];
    if (batch.length < BATCH) break;
  }
  return {
    filename: `production-events-${new Date(query.from).toISOString().slice(0, 10)}.csv`,
    content: Buffer.from(parts.join(''), 'utf8'),
  };
}
