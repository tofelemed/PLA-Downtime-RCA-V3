import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { applyOverlapWindow } from '../../common/query/overlap-window';
import { StandbyRecord } from '../../reliability/entities/standby-record.entity';
import { keysetPage } from '../common/keyset-page';
import {
  AssetRef,
  assetsOf,
  assertUnitsWritable,
  RowProblem,
  rowsInvalid,
} from './reliability-v2-common';
import {
  StandbyListQueryDto,
  StandbyRecordRowDto,
  StandbyRecordsImportDto,
} from './standby-v2.dto';
import { StandbyImportV2View } from './standby-v2.view';

/** Problem of one row, or null (asset known, interval and outcome consistent, event of the tenant). */
function rowProblem(
  row: StandbyRecordRowDto,
  asset: AssetRef | undefined,
  knownEvents: ReadonlySet<string>,
): string | null {
  if (!asset) return 'assetId / assetCode must name an asset of this plant';
  if (row.endedAt && new Date(row.endedAt) < new Date(row.startedAt))
    return 'endedAt must not be before startedAt';
  if (row.outcome === 'failed_while_running' && row.kind !== 'run')
    return 'failed_while_running is an outcome of a run';
  if (row.outcome === 'failed_start' && row.kind === 'run')
    return 'a run cannot fail to start; record the demand';
  if (row.eventId && !knownEvents.has(row.eventId))
    return 'eventId must be an event of this plant';
  return null;
}

const assetOfRow = (row: StandbyRecordRowDto, assets: readonly AssetRef[]) =>
  assets.find((a) =>
    row.assetId
      ? a.id === row.assetId
      : a.code.toLowerCase() === row.assetCode?.toLowerCase(),
  );

/**
 * Standby demand / test / running logs (SME D9), imported as JSON rows — the asset by id or code, all or
 * nothing (422 STANDBY_IMPORT_INVALID with row problems). A row with the log's own `externalRef` replaces
 * the entry of that ref; rows without one are added.
 */
@Injectable()
export class StandbyRecordsV2Service {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  list(context: RequestContext, query: StandbyListQueryDto) {
    const qb = scopedQuery(this.manager.getRepository(StandbyRecord), 'r', {
      context,
      unitProperty: 'unitId',
    });
    if (query.assetIds?.length)
      qb.andWhere('r.assetId IN (:...assetIds)', { assetIds: query.assetIds });
    applyOverlapWindow(
      qb,
      { alias: 'r', start: 'startedAt', end: 'endedAt' },
      query.from,
      query.to,
    );
    return keysetPage(qb, {
      alias: 'r',
      property: 'startedAt',
      direction: 'ASC',
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  async import(
    context: RequestContext,
    input: StandbyRecordsImportDto,
  ): Promise<StandbyImportV2View> {
    const tenantId = requireTenantId(context);
    const rows = input.records;
    const assets = await assetsOf(this.manager, tenantId, {
      ids: rows.flatMap((r) => (r.assetId ? [r.assetId] : [])),
      codes: rows.flatMap((r) =>
        !r.assetId && r.assetCode ? [r.assetCode] : [],
      ),
    });
    const knownEvents = await this.eventsOf(
      tenantId,
      rows.flatMap((r) => (r.eventId ? [r.eventId] : [])),
    );
    const problems: RowProblem[] = [];
    const seen = new Set<string>();
    const resolved = rows.map((row, i) => {
      const asset = assetOfRow(row, assets);
      const repeated =
        row.externalRef !== undefined && seen.has(row.externalRef);
      if (row.externalRef) seen.add(row.externalRef);
      const problem = repeated
        ? `externalRef ${row.externalRef} appears twice`
        : rowProblem(row, asset, knownEvents);
      if (problem) problems.push({ line: i + 1, message: problem });
      return { row, asset: asset as AssetRef };
    });
    if (problems.length > 0)
      throw rowsInvalid('STANDBY_IMPORT_INVALID', problems);
    assertUnitsWritable(
      context,
      resolved.map((r) => r.asset.unitId),
    );
    return this.manager.transaction((manager) =>
      upsert(manager, tenantId, context.userId, resolved),
    );
  }

  private async eventsOf(
    tenantId: string,
    ids: string[],
  ): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await this.manager.query<Array<{ id: string }>>(
      `SELECT "id" FROM "production_events" WHERE "tenant_id" = $1 AND "id" = ANY($2::uuid[])`,
      [tenantId, [...new Set(ids)]],
    );
    return new Set(rows.map((r) => r.id));
  }
}

async function upsert(
  manager: EntityManager,
  tenantId: string,
  actorId: string | null,
  rows: ReadonlyArray<{ row: StandbyRecordRowDto; asset: AssetRef }>,
): Promise<StandbyImportV2View> {
  const repository = manager.getRepository(StandbyRecord);
  const refs = rows.flatMap((r) =>
    r.row.externalRef ? [r.row.externalRef] : [],
  );
  const existing = refs.length
    ? await repository
        .createQueryBuilder('r')
        .where('r.tenantId = :tenantId AND r.externalRef IN (:...refs)', {
          tenantId,
          refs,
        })
        .getMany()
    : [];
  const byRef = new Map(existing.map((e) => [e.externalRef, e]));
  let updated = 0;
  const inserts: Array<Partial<StandbyRecord>> = [];
  for (const { row, asset } of rows) {
    const columns: Partial<StandbyRecord> = {
      assetId: asset.id,
      unitId: asset.unitId,
      recordKind: row.kind,
      startedAt: new Date(row.startedAt),
      endedAt: row.endedAt ? new Date(row.endedAt) : null,
      outcome: row.outcome,
      eventId: row.eventId ?? null,
      notes: row.notes?.trim() || null,
      updatedBy: actorId,
    };
    const found = row.externalRef ? byRef.get(row.externalRef) : undefined;
    if (found) {
      await repository.update(found.id, columns);
      updated++;
    } else
      inserts.push({
        ...columns,
        tenantId,
        externalRef: row.externalRef ?? null,
        createdBy: actorId,
      });
  }
  for (let i = 0; i < inserts.length; i += 500)
    await repository.insert(inserts.slice(i, i + 500));
  return { total: rows.length, created: inserts.length, updated };
}
