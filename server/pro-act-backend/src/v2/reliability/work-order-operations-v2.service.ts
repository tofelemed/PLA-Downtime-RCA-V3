import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { applyOverlapWindow } from '../../common/query/overlap-window';
import { scopedQuery } from '../../common/query/scoped-query';
import { periodScopeUnits } from '../../periods/period-scope';
import { WorkOrderOperation } from '../../reliability/entities/work-order-operation.entity';
import { keysetPage } from '../common/keyset-page';
import {
  AssetRef,
  assetsOf,
  assertUnitsWritable,
  RowProblem,
  rowsInvalid,
} from './reliability-v2-common';
import {
  WorkOrderOperationListQueryDto,
  WorkOrderOperationRowDto,
  WorkOrderOperationsImportDto,
} from './work-order-operations-v2.dto';
import {
  occurrenceSpans,
  requestReliabilityRecalc,
} from './reliability-recalc';

export interface WorkOrderImportV2View {
  total: number;
  created: number;
  updated: number;
  /** operations linked to a stop (given or found) */
  linked: number;
}

interface StopRow {
  id: string;
  unit_id: string;
  asset_id: string | null;
  start_time: Date;
  end_time: Date | null;
}

interface Resolved {
  row: WorkOrderOperationRowDto;
  unitId: string;
  assetId: string | null;
  eventId: string | null;
}

const CODE = 'WORK_ORDER_IMPORT_INVALID';
const keyOf = (workOrderId: string, operationId: string) =>
  `${workOrderId}|${operationId}`;

/** The stop of the asset running at the operation start (latest start), when the row names none. */
function stopAt(
  stops: readonly StopRow[],
  assetId: string | null,
  at: Date,
): StopRow | undefined {
  return stops
    .filter(
      (s) =>
        s.asset_id === assetId &&
        new Date(s.start_time) <= at &&
        (!s.end_time || new Date(s.end_time) > at),
    )
    .sort(
      (a, b) =>
        new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
    )[0];
}

/**
 * CMMS work-order operations (SME D10): the mapping endpoint of the plant's CMMS export — no connector.
 * Rows upsert on work order + operation, all or nothing (422 WORK_ORDER_IMPORT_INVALID with row
 * problems). A row without `eventId` is linked to the stop of its asset that was running at the operation
 * start. A unit-scoped caller writes only its units' operations, also when replacing a stored one.
 */
@Injectable()
export class WorkOrderOperationsV2Service {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  list(context: RequestContext, query: WorkOrderOperationListQueryDto) {
    const qb = scopedQuery(
      this.manager.getRepository(WorkOrderOperation),
      'o',
      { context, unitProperty: 'unitId' },
    );
    if (query.eventIds?.length)
      qb.andWhere('o.eventId IN (:...eventIds)', { eventIds: query.eventIds });
    if (query.assetIds?.length)
      qb.andWhere('o.assetId IN (:...assetIds)', { assetIds: query.assetIds });
    applyOverlapWindow(
      qb,
      { alias: 'o', start: 'startedAt', end: 'endedAt' },
      query.from,
      query.to,
    );
    return keysetPage(qb, {
      alias: 'o',
      property: 'startedAt',
      direction: 'ASC',
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  async import(
    context: RequestContext,
    input: WorkOrderOperationsImportDto,
  ): Promise<WorkOrderImportV2View> {
    const tenantId = requireTenantId(context);
    const rows = input.operations;
    const assets = await assetsOf(this.manager, tenantId, {
      ids: rows.flatMap((r) => (r.assetId ? [r.assetId] : [])),
      codes: rows.flatMap((r) =>
        !r.assetId && r.assetCode ? [r.assetCode] : [],
      ),
    });
    const stops = await this.stopsFor(
      tenantId,
      { rows, assets },
      periodScopeUnits(context),
    );
    const { resolved, problems } = resolveRows(rows, assets, stops);
    if (problems.length > 0) throw rowsInvalid(CODE, problems);
    const stopUnits = new Map(stops.map((s) => [s.id, s.unit_id]));
    assertUnitsWritable(context, [
      ...resolved.map((r) => r.unitId),
      ...resolved.flatMap((r) => {
        const unit = r.eventId ? stopUnits.get(r.eventId) : undefined;
        return unit ? [unit] : [];
      }),
    ]);
    return this.manager.transaction(async (manager) => {
      const { view, linkedBefore } = await upsert(
        manager,
        {
          tenantId,
          actorId: context.userId,
          allowedUnits: periodScopeUnits(context),
        },
        resolved,
      );
      // mean active repair time of the stops linked now or before (their periods, SME D10)
      const stops = [
        ...linkedBefore,
        ...resolved.flatMap((r) => (r.eventId ? [r.eventId] : [])),
      ];
      await requestReliabilityRecalc(
        manager,
        context,
        await occurrenceSpans(manager, tenantId, stops),
        'work_order_operations_imported',
      );
      return view;
    });
  }

  /**
   * Downtime events the rows name or may be linked to (assets of the rows, around their starts), only of
   * the caller's units: a stop of another unit is never found, so it can never be linked.
   */
  private async stopsFor(
    tenantId: string,
    input: {
      rows: readonly WorkOrderOperationRowDto[];
      assets: readonly AssetRef[];
    },
    allowedUnits: readonly string[] | null,
  ): Promise<StopRow[]> {
    const starts = input.rows.map((r) => Date.parse(r.startedAt));
    return this.manager.query<StopRow[]>(
      `SELECT "id", "unit_id", "asset_id", "start_time", "end_time" FROM "production_events"
        WHERE "tenant_id" = $1 AND "physical_state" IN ('open', 'closed')
          AND ($6::uuid[] IS NULL OR "unit_id" = ANY($6::uuid[])) AND (
          "id" = ANY($2::uuid[]) OR ("physical_type" = 'downtime' AND "asset_id" = ANY($3::uuid[])
            AND "start_time" <= $5 AND ("end_time" IS NULL OR "end_time" > $4)))`,
      [
        tenantId,
        input.rows.flatMap((r) => (r.eventId ? [r.eventId] : [])),
        input.assets.map((a) => a.id),
        new Date(Math.min(...starts)),
        new Date(Math.max(...starts)),
        allowedUnits,
      ],
    );
  }
}

function resolveRows(
  rows: readonly WorkOrderOperationRowDto[],
  assets: readonly AssetRef[],
  stops: readonly StopRow[],
): { resolved: Resolved[]; problems: RowProblem[] } {
  const problems: RowProblem[] = [];
  const seen = new Set<string>();
  const resolved = rows.map((row, i): Resolved => {
    const problem = (message: string) =>
      problems.push({ line: i + 1, message });
    const asset = assets.find((a) =>
      row.assetId
        ? a.id === row.assetId
        : a.code.toLowerCase() === row.assetCode?.toLowerCase(),
    );
    const named = row.eventId
      ? stops.find((s) => s.id === row.eventId)
      : undefined;
    const key = keyOf(row.workOrderId, row.operationId);
    if (seen.has(key)) problem(`operation ${key} appears twice`);
    seen.add(key);
    if ((row.assetId || row.assetCode) && !asset)
      problem('assetId / assetCode must name an asset of this plant');
    if (row.eventId && !named)
      problem('eventId must be an event of this plant and of your units');
    if (asset && named && named.unit_id !== asset.unitId)
      problem('the stop must be of the asset’s unit');
    if (asset && named?.asset_id && named.asset_id !== asset.id)
      problem('the stop belongs to another asset');
    if (!asset && !named)
      problem('an operation names its asset or the stop it repaired');
    if (row.endedAt && new Date(row.endedAt) < new Date(row.startedAt))
      problem('endedAt must not be before startedAt');
    const stop =
      named ??
      (asset ? stopAt(stops, asset.id, new Date(row.startedAt)) : undefined);
    return {
      row,
      unitId: asset?.unitId ?? named?.unit_id ?? '',
      assetId: asset?.id ?? named?.asset_id ?? null,
      eventId: stop?.id ?? null,
    };
  });
  return { resolved, problems };
}

async function upsert(
  manager: EntityManager,
  stamp: {
    tenantId: string;
    actorId: string | null;
    allowedUnits: readonly string[] | null;
  },
  rows: readonly Resolved[],
): Promise<{ view: WorkOrderImportV2View; linkedBefore: string[] }> {
  const repository = manager.getRepository(WorkOrderOperation);
  const existing = await repository
    .createQueryBuilder('o')
    .where('o.tenantId = :tenantId', { tenantId: stamp.tenantId })
    .andWhere('o.workOrderId IN (:...orders)', {
      orders: [...new Set(rows.map((r) => r.row.workOrderId))],
    })
    .getMany();
  const byKey = new Map(
    existing.map((e) => [keyOf(e.workOrderId, e.operationId), e]),
  );
  const foreign = rows.flatMap(({ row }, i) => {
    const found = byKey.get(keyOf(row.workOrderId, row.operationId));
    return found &&
      stamp.allowedUnits &&
      !stamp.allowedUnits.includes(found.unitId)
      ? [
          {
            line: i + 1,
            message: `operation ${row.workOrderId}/${row.operationId} belongs to a unit outside your scope`,
          },
        ]
      : [];
  });
  if (foreign.length > 0) throw rowsInvalid(CODE, foreign);
  const inserts: Array<Partial<WorkOrderOperation>> = [];
  const linkedBefore: string[] = [];
  for (const r of rows) {
    const columns = columnsOf(r, stamp.actorId);
    const found = byKey.get(keyOf(r.row.workOrderId, r.row.operationId));
    if (found) {
      await repository.update(found.id, columns);
      if (found.eventId) linkedBefore.push(found.eventId);
    } else
      inserts.push({
        ...columns,
        tenantId: stamp.tenantId,
        workOrderId: r.row.workOrderId,
        operationId: r.row.operationId,
        createdBy: stamp.actorId,
      });
  }
  for (let i = 0; i < inserts.length; i += 500)
    await repository.insert(inserts.slice(i, i + 500));
  const view = {
    total: rows.length,
    created: inserts.length,
    updated: rows.length - inserts.length,
    linked: rows.filter((r) => r.eventId).length,
  };
  return { view, linkedBefore };
}

function columnsOf(
  r: Resolved,
  actorId: string | null,
): Partial<WorkOrderOperation> {
  return {
    unitId: r.unitId,
    assetId: r.assetId,
    eventId: r.eventId,
    operationKind: r.row.kind,
    description: r.row.description?.trim() || null,
    startedAt: new Date(r.row.startedAt),
    endedAt: r.row.endedAt ? new Date(r.row.endedAt) : null,
    waitingSeconds: r.row.waitingSeconds ?? 0,
    waitingReason: r.row.waitingReason?.trim() || null,
    source: r.row.source?.trim() || 'import',
    updatedBy: actorId,
  };
}
