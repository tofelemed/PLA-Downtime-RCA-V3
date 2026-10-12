import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { VerificationStatusCode } from '../../verification-status-code/verification-status-code.entity';
import { listResponse, ListResponse } from '../common/response';
import { MasterDataListQueryDto } from '../master-data/common/master-data-list-query.dto';
import {
  codeTaken,
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
  VerificationChecklistV2ChangeDto,
  VerificationChecklistV2CreateDto,
} from './rca-settings-v2.dto';
import {
  toChecklistView,
  VerificationChecklistV2View,
} from './rca-settings-v2.view';

/**
 * Verification checklists of the acting plant (RCA settings): code, name, badge colour and an ordered
 * list of items. Retire (`is_active = false`) replaces the v1 delete. Codes are unique (the v1 table has
 * one global unique key on `code`).
 */
@Injectable()
export class VerificationChecklistsV2Service {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  async list(
    context: RequestContext,
    query: MasterDataListQueryDto,
  ): Promise<ListResponse<VerificationChecklistV2View>> {
    const tenantId = requireTenantId(context);
    const qb = scopedQuery(
      this.manager.getRepository(VerificationStatusCode),
      'v',
      { context },
    );
    const status = statusIncludes(query.status);
    if (!status.retired) qb.andWhere('v.isActive = true');
    if (!status.active) qb.andWhere('v.isActive = false');
    applySearch(qb, 'v', query.q);
    const page = await sortedKeysetPage(qb, {
      alias: 'v',
      sort: query.sort,
      cursor: query.cursor,
      limit: query.limit,
    });
    return listResponse(page.items.map(toChecklistView), page.nextCursor, {
      tenantId,
    });
  }

  async get(
    context: RequestContext,
    id: string,
  ): Promise<VerificationChecklistV2View> {
    return toChecklistView(await this.find(context, id, this.manager));
  }

  async create(
    context: RequestContext,
    input: VerificationChecklistV2CreateDto,
  ): Promise<VerificationChecklistV2View> {
    const stamp = writerStamp(context);
    try {
      return await this.manager.transaction(async (manager) => {
        await assertCodeFree(manager, input.code);
        const id = randomUUID();
        await manager.getRepository(VerificationStatusCode).insert({
          id,
          tenantId: stamp.tenantId,
          organizationId: await organizationOfTenant(manager, stamp.tenantId),
          code: input.code,
          name: input.name,
          description: input.description ?? undefined,
          color: input.color ?? null,
          items: input.items ?? [],
          isActive: true,
        });
        return toChecklistView(await this.find(context, id, manager));
      });
    } catch (error) {
      throw isUniqueViolation(error)
        ? codeTaken('verification checklist', input.code)
        : error;
    }
  }

  async change(
    context: RequestContext,
    target: { id: string; expectedVersion: number },
    input: VerificationChecklistV2ChangeDto,
  ): Promise<VerificationChecklistV2View> {
    writerStamp(context);
    const code = keepUnlessGiven(input.code);
    try {
      return await this.manager.transaction(async (manager) => {
        const row = await this.find(context, target.id, manager);
        if (!row.isActive) throw recordRetired('verification checklist');
        if (code !== undefined && code !== row.code)
          await assertCodeFree(manager, code, row.id);
        await updateWithRevision(manager, VerificationStatusCode, target, {
          ...definedOnly({
            code,
            name: keepUnlessGiven(input.name),
            description: input.description,
            color: input.color,
            items: input.items,
          }),
        });
        return toChecklistView(await this.find(context, row.id, manager));
      });
    } catch (error) {
      throw isUniqueViolation(error)
        ? codeTaken('verification checklist', code ?? '')
        : error;
    }
  }

  async setActive(
    context: RequestContext,
    id: string,
    active: boolean,
  ): Promise<VerificationChecklistV2View> {
    writerStamp(context);
    return this.manager.transaction(async (manager) => {
      const row = await this.find(context, id, manager);
      if (row.isActive === active) {
        throw active
          ? recordNotRetired('verification checklist')
          : recordRetired('verification checklist');
      }
      await manager
        .getRepository(VerificationStatusCode)
        .update(row.id, { isActive: active });
      return toChecklistView(await this.find(context, row.id, manager));
    });
  }

  private async find(
    context: RequestContext,
    id: string,
    manager: EntityManager,
  ): Promise<VerificationStatusCode> {
    const row = await scopedQuery(
      manager.getRepository(VerificationStatusCode),
      'v',
      { context },
    )
      .andWhere('v.id = :id', { id })
      .getOne();
    if (!row) throw recordNotFound('verification checklist');
    return row;
  }
}

/** 409 MASTER_DATA_CODE_EXISTS: checklist codes are unique in the whole table (v1 unique key), any case. */
async function assertCodeFree(
  manager: EntityManager,
  code: string,
  exceptId?: string,
): Promise<void> {
  const rows = await manager.query<unknown[]>(
    `SELECT 1 FROM "verification_status_codes" WHERE lower("code") = lower($1) AND "id" <> $2 LIMIT 1`,
    [code, exceptId ?? '00000000-0000-0000-0000-000000000000'],
  );
  if (rows.length > 0) throw codeTaken('verification checklist', code);
}
