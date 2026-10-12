import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { scopedQuery } from '../../common/query/scoped-query';
import { RCATemplate } from '../../rca-template/rca-template.entity';
import { listResponse, ListResponse } from '../common/response';
import { MasterDataListQueryDto } from '../master-data/common/master-data-list-query.dto';
import {
  invalidField,
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
import { containsPattern } from '../master-data/common/search';
import { sortedKeysetPage } from '../master-data/common/sorted-keyset-page';
import {
  LogicTreeNodeDto,
  RcaTemplateV2ChangeDto,
  RcaTemplateV2CreateDto,
} from './rca-settings-v2.dto';
import {
  RcaTemplateV2View,
  templateDataOf,
  TemplateData,
  toTemplateView,
} from './rca-settings-v2.view';

const MAX_NODES = 500;
const MAX_DEPTH = 12;

/**
 * RCA templates of the acting plant (master data): name, category, description, the logic tree and the
 * verification checklists it asks for. The tree and the checklist ids live in `template_data`
 * (`{ nodes, checklistIds }`) — the shape v1 already wrote, so v1 RCA screens keep reading `nodes`.
 * Retire (`is_active = false`) replaces the v1 delete: RCA cases keep their template.
 */
@Injectable()
export class RcaTemplatesV2Service {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  async list(
    context: RequestContext,
    query: MasterDataListQueryDto,
  ): Promise<ListResponse<RcaTemplateV2View>> {
    const tenantId = requireTenantId(context);
    const qb = scopedQuery(this.manager.getRepository(RCATemplate), 't', {
      context,
    });
    const status = statusIncludes(query.status);
    if (!status.retired) qb.andWhere('t.isActive = true');
    if (!status.active) qb.andWhere('t.isActive = false');
    const text = query.q?.trim();
    if (text) {
      qb.andWhere(
        '(t.name ILIKE :searchText OR t.category ILIKE :searchText)',
        {
          searchText: containsPattern(text),
        },
      );
    }
    const page = await sortedKeysetPage(qb, {
      alias: 't',
      sort: query.sort,
      cursor: query.cursor,
      limit: query.limit,
      properties: { code: 'name' },
    });
    return listResponse(
      page.items.map((row) => toTemplateView(row, false)),
      page.nextCursor,
      { tenantId },
    );
  }

  async get(context: RequestContext, id: string): Promise<RcaTemplateV2View> {
    return toTemplateView(await this.find(context, id, this.manager), true);
  }

  async create(
    context: RequestContext,
    input: RcaTemplateV2CreateDto,
  ): Promise<RcaTemplateV2View> {
    const stamp = writerStamp(context);
    return this.manager.transaction(async (manager) => {
      const data = await validData(manager, stamp.tenantId, {
        nodes: input.logicTree ?? [],
        checklistIds: input.checklistIds ?? [],
      });
      const id = randomUUID();
      const repository = manager.getRepository(RCATemplate);
      const row = repository.create({
        id,
        tenantId: stamp.tenantId,
        organizationId: await organizationOfTenant(manager, stamp.tenantId),
        name: input.name,
        category: input.category,
        description: input.description ?? undefined,
        logicTreeStructure: data,
        isActive: true,
      });
      await repository.insert(row);
      return toTemplateView(await this.find(context, id, manager), true);
    });
  }

  async change(
    context: RequestContext,
    target: { id: string; expectedVersion: number },
    input: RcaTemplateV2ChangeDto,
  ): Promise<RcaTemplateV2View> {
    const stamp = writerStamp(context);
    return this.manager.transaction(async (manager) => {
      const row = await this.find(context, target.id, manager);
      if (!row.isActive) throw recordRetired('RCA template');
      const current = templateDataOf(row.logicTreeStructure);
      const changesData =
        input.logicTree !== undefined || input.checklistIds !== undefined;
      const data = changesData
        ? await validData(manager, stamp.tenantId, {
            nodes: input.logicTree ?? current.nodes,
            checklistIds: input.checklistIds ?? current.checklistIds,
          })
        : undefined;
      await updateWithRevision(manager, RCATemplate, target, {
        ...definedOnly({
          name: keepUnlessGiven(input.name),
          category: keepUnlessGiven(input.category),
          description: input.description,
        }),
        ...(data ? { logicTreeStructure: JSON.stringify(data) } : {}),
      });
      return toTemplateView(await this.find(context, row.id, manager), true);
    });
  }

  async setActive(
    context: RequestContext,
    id: string,
    active: boolean,
  ): Promise<RcaTemplateV2View> {
    writerStamp(context);
    return this.manager.transaction(async (manager) => {
      const row = await this.find(context, id, manager);
      if (row.isActive === active) {
        throw active
          ? recordNotRetired('RCA template')
          : recordRetired('RCA template');
      }
      await manager
        .getRepository(RCATemplate)
        .update(row.id, { isActive: active });
      return toTemplateView(await this.find(context, row.id, manager), true);
    });
  }

  private async find(
    context: RequestContext,
    id: string,
    manager: EntityManager,
  ): Promise<RCATemplate> {
    const row = await scopedQuery(manager.getRepository(RCATemplate), 't', {
      context,
    })
      .andWhere('t.id = :id', { id })
      .getOne();
    if (!row) throw recordNotFound('RCA template');
    return row;
  }
}

/** 422 for a tree beyond the limits, duplicate node ids or checklists that are not active ones of the plant. */
async function validData(
  manager: EntityManager,
  tenantId: string,
  data: TemplateData,
): Promise<TemplateData> {
  const seen = new Set<string>();
  const walk = (nodes: readonly LogicTreeNodeDto[], depth: number): void => {
    if (depth > MAX_DEPTH)
      throw invalidField(
        'logicTree',
        `The logic tree may have at most ${MAX_DEPTH} levels`,
      );
    for (const node of nodes) {
      if (seen.has(node.id))
        throw invalidField(
          'logicTree',
          'Every logic tree node needs its own id',
        );
      seen.add(node.id);
      walk(node.children ?? [], depth + 1);
    }
  };
  walk(data.nodes as LogicTreeNodeDto[], 1);
  if (seen.size > MAX_NODES)
    throw invalidField(
      'logicTree',
      `The logic tree may have at most ${MAX_NODES} nodes`,
    );
  const checklistIds = [...new Set(data.checklistIds)];
  if (checklistIds.length > 0) {
    const rows = await manager.query<Array<{ id: string }>>(
      `SELECT "id" FROM "verification_status_codes" WHERE "tenant_id" = $1 AND "is_active" AND "id" = ANY($2::uuid[])`,
      [tenantId, checklistIds],
    );
    if (rows.length !== checklistIds.length) {
      throw invalidField(
        'checklistIds',
        'checklistIds must be active verification checklists of this plant',
      );
    }
  }
  return { nodes: data.nodes, checklistIds };
}
