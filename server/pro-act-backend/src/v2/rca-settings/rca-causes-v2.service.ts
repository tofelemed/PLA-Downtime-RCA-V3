import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { RCACauseCode } from '../../rca-cause-code/rca-cause-code.entity';
import { assertValidCauseParent } from '../../rca-cause-code/rca-cause-parent';
import { listResponse, ListResponse } from '../common/response';
import {
  causeHasChildren,
  codeTaken,
  invalidField,
  isUniqueViolation,
  recordNotFound,
  recordNotRetired,
  recordRetired,
} from '../master-data/common/master-data-errors';
import {
  organizationOfTenant,
  statusIncludes,
  writerStamp,
} from '../master-data/common/master-data-writer';
import {
  definedOnly,
  keepUnlessGiven,
  updateWithRevision,
} from '../master-data/common/revisioned-update';
import { applySearch } from '../master-data/common/search';
import { sortedKeysetPage } from '../master-data/common/sorted-keyset-page';
import {
  RcaCauseV2ChangeDto,
  RcaCauseV2CreateDto,
  RcaCauseV2ListQueryDto,
} from './rca-settings-v2.dto';
import { RcaCauseV2View, toCauseView } from './rca-settings-v2.view';

/**
 * RCA cause library of the acting plant: a tree of causes (6M category, acyclic, one tenant). The tree
 * loads level by level (`rootsOnly`, `parentId`); every item carries its count of active sub-causes.
 * Retire replaces the v1 delete (which removed the whole subtree) and is refused while active
 * sub-causes exist. Cause codes are unique (the v1 table has one global unique key on `code`).
 */
@Injectable()
export class RcaCausesV2Service {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  async list(
    context: RequestContext,
    query: RcaCauseV2ListQueryDto,
  ): Promise<ListResponse<RcaCauseV2View>> {
    const tenantId = requireTenantId(context);
    const qb = scopedQuery(this.manager.getRepository(RCACauseCode), 'c', {
      context,
    });
    if (query.parentId)
      qb.andWhere('c.parentId = :parentId', { parentId: query.parentId });
    if (query.rootsOnly) qb.andWhere('c.parentId IS NULL');
    const status = statusIncludes(query.status);
    if (!status.retired) qb.andWhere('c.isActive = true');
    if (!status.active) qb.andWhere('c.isActive = false');
    applySearch(qb, 'c', query.q);
    const page = await sortedKeysetPage(qb, {
      alias: 'c',
      sort: query.sort,
      cursor: query.cursor,
      limit: query.limit,
    });
    const children = await activeChildCounts(
      this.manager,
      page.items.map((row) => row.id),
    );
    const items = page.items.map((row) =>
      toCauseView(row, children.get(row.id) ?? 0),
    );
    return listResponse(items, page.nextCursor, { tenantId });
  }

  async get(context: RequestContext, id: string): Promise<RcaCauseV2View> {
    return this.view(context, id, this.manager);
  }

  async create(
    context: RequestContext,
    input: RcaCauseV2CreateDto,
  ): Promise<RcaCauseV2View> {
    const stamp = writerStamp(context);
    try {
      return await this.manager.transaction(async (manager) => {
        await assertCodeFree(manager, input.code);
        const parentId = input.parentId ?? null;
        if (parentId)
          await assertActiveParent(manager, stamp.tenantId, parentId);
        const id = randomUUID();
        await manager.getRepository(RCACauseCode).insert({
          id,
          tenantId: stamp.tenantId,
          organizationId: await organizationOfTenant(manager, stamp.tenantId),
          code: input.code,
          name: input.name,
          category: input.category,
          description: input.description ?? undefined,
          parentId,
          isActive: true,
        });
        return this.view(context, id, manager);
      });
    } catch (error) {
      throw isUniqueViolation(error)
        ? codeTaken('RCA cause', input.code)
        : error;
    }
  }

  async change(
    context: RequestContext,
    target: { id: string; expectedVersion: number },
    input: RcaCauseV2ChangeDto,
  ): Promise<RcaCauseV2View> {
    const stamp = writerStamp(context);
    const code = keepUnlessGiven(input.code);
    try {
      return await this.manager.transaction(async (manager) => {
        const row = await this.find(context, target.id, manager);
        if (!row.isActive) throw recordRetired('RCA cause');
        if (code !== undefined && code !== row.code)
          await assertCodeFree(manager, code, row.id);
        if (input.parentId) {
          await assertActiveParent(manager, stamp.tenantId, input.parentId);
          const repository = manager.getRepository(RCACauseCode);
          await assertValidCauseParent(
            repository,
            { id: row.id, tenantId: stamp.tenantId },
            input.parentId,
          );
        }
        await updateWithRevision(manager, RCACauseCode, target, {
          ...definedOnly({
            code,
            name: keepUnlessGiven(input.name),
            category: input.category,
            description: input.description,
            parentId: input.parentId,
          }),
        });
        return this.view(context, row.id, manager);
      });
    } catch (error) {
      throw isUniqueViolation(error)
        ? codeTaken('RCA cause', code ?? '')
        : error;
    }
  }

  async setActive(
    context: RequestContext,
    id: string,
    active: boolean,
  ): Promise<RcaCauseV2View> {
    const stamp = writerStamp(context);
    return this.manager.transaction(async (manager) => {
      const row = await this.find(context, id, manager);
      if (row.isActive === active)
        throw active
          ? recordNotRetired('RCA cause')
          : recordRetired('RCA cause');
      if (!active) {
        const children =
          (await activeChildCounts(manager, [row.id])).get(row.id) ?? 0;
        if (children > 0) throw causeHasChildren(children);
      } else if (row.parentId) {
        await assertActiveParent(manager, stamp.tenantId, row.parentId);
      }
      await manager
        .getRepository(RCACauseCode)
        .update(row.id, { isActive: active });
      return this.view(context, row.id, manager);
    });
  }

  private async view(
    context: RequestContext,
    id: string,
    manager: EntityManager,
  ): Promise<RcaCauseV2View> {
    const row = await this.find(context, id, manager);
    const children = await activeChildCounts(manager, [row.id]);
    return toCauseView(row, children.get(row.id) ?? 0);
  }

  private async find(
    context: RequestContext,
    id: string,
    manager: EntityManager,
  ): Promise<RCACauseCode> {
    const row = await scopedQuery(manager.getRepository(RCACauseCode), 'c', {
      context,
    })
      .andWhere('c.id = :id', { id })
      .getOne();
    if (!row) throw recordNotFound('RCA cause');
    return row;
  }
}

/** Active direct sub-causes per cause, in one query for a whole page. */
async function activeChildCounts(
  manager: EntityManager,
  ids: string[],
): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await manager.query<Array<{ parent_id: string; count: number }>>(
    `SELECT "parent_id", count(*)::int AS count FROM "rca_cause_codes"
      WHERE "parent_id" = ANY($1::uuid[]) AND "is_active" GROUP BY "parent_id"`,
    [ids],
  );
  return new Map(rows.map((row) => [row.parent_id, row.count]));
}

/** 422 INVALID_REFERENCE unless the parent is an active cause of the plant. */
async function assertActiveParent(
  manager: EntityManager,
  tenantId: string,
  parentId: string,
): Promise<void> {
  const rows = await manager.query<unknown[]>(
    `SELECT 1 FROM "rca_cause_codes" WHERE "id" = $1 AND "tenant_id" = $2 AND "is_active"`,
    [parentId, tenantId],
  );
  if (rows.length === 0)
    throw invalidField(
      'parentId',
      'parentId must be an active RCA cause of this plant',
    );
}

/** 409 MASTER_DATA_CODE_EXISTS: cause codes are unique in the whole table (v1 unique key), any case. */
async function assertCodeFree(
  manager: EntityManager,
  code: string,
  exceptId?: string,
): Promise<void> {
  const rows = await manager.query<unknown[]>(
    `SELECT 1 FROM "rca_cause_codes" WHERE lower("code") = lower($1) AND "id" <> $2 LIMIT 1`,
    [code, exceptId ?? '00000000-0000-0000-0000-000000000000'],
  );
  if (rows.length > 0) throw codeTaken('RCA cause', code);
}
