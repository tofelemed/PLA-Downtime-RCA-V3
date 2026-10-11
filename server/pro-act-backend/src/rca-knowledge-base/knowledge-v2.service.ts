import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { restrictedUnitIds, scopedQuery } from '../common/query/scoped-query';
import { keysetPage } from '../v2/common/keyset-page';
import { listResponse, ListResponse } from '../v2/common/response';
import { RcaKnowledgeListQueryDto } from '../v2/rca-knowledge/rca-knowledge-v2.dto';
import { loadKnowledgeDetails } from './knowledge-details';
import { RcaKnowledgeV2View, toKnowledgeView } from './knowledge-v2.view';
import { RCAKnowledgeBase } from './rca-knowledge-base.entity';

export const KB_ALIAS = 'kb';

/** Entries whose source case links an event matching `condition` (alias `e`). */
export const LINKED_EVENT = (condition: string): string =>
  `EXISTS (SELECT 1 FROM "rca_case_links" k JOIN "production_events" e ON e."id"::text = k."target_id"
     WHERE k."rca_id" = "${KB_ALIAS}"."rca_id" AND k."tenant_id"::text = "${KB_ALIAS}"."tenant_id"
       AND k."link_type" = 'event' AND ${condition})`;

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/** Entries of the caller's tenant (and units, for a unit-limited grant): `scopedQuery` first. */
export function scopedEntries(
  manager: EntityManager,
  context: RequestContext,
): SelectQueryBuilder<RCAKnowledgeBase> {
  return scopedQuery(manager.getRepository(RCAKnowledgeBase), KB_ALIAS, {
    context,
    unitProperty: 'unitId',
  });
}

function applyFilters(
  qb: SelectQueryBuilder<RCAKnowledgeBase>,
  query: RcaKnowledgeListQueryDto,
): void {
  if (query.q) {
    qb.andWhere(
      `(kb.title ILIKE :q OR kb.rootCause ILIKE :q OR kb.problemStatement ILIKE :q OR kb.description ILIKE :q)`,
      { q: `%${escapeLike(query.q)}%` },
    );
  }
  if (query.unitId)
    qb.andWhere('kb.unitId = :unitId', { unitId: query.unitId });
  if (query.assetId) {
    qb.andWhere(
      `(kb.assetId = :assetId OR ${LINKED_EVENT('e."asset_id"::text = :assetId')})`,
      { assetId: query.assetId },
    );
  }
  if (query.reasonCodeId) {
    qb.andWhere(LINKED_EVENT('e."reason_code_id" = :reasonCodeId'), {
      reasonCodeId: query.reasonCodeId,
    });
  }
  if (query.published !== undefined) {
    qb.andWhere('kb.isPublished = :published', { published: query.published });
  }
  if (query.from)
    qb.andWhere('kb.createdAt >= :from', { from: new Date(query.from) });
  if (query.to) qb.andWhere('kb.createdAt < :to', { to: new Date(query.to) });
}

function assertRange(query: RcaKnowledgeListQueryDto): void {
  if (query.from && query.to && !(new Date(query.from) < new Date(query.to))) {
    throw new UnprocessableEntityException({
      code: 'INVALID_RANGE',
      message: 'from must be before to',
    });
  }
}

/**
 * RCA knowledge base on v2 (owner decision 2026-10-12): server-side search and keyset paging over the
 * entries written when cases close, with names, case, action and vote facts loaded per page and the
 * quality score computed here (never in the browser).
 */
@Injectable()
export class RcaKnowledgeV2Service {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async list(
    context: RequestContext,
    query: RcaKnowledgeListQueryDto,
  ): Promise<ListResponse<RcaKnowledgeV2View>> {
    assertRange(query);
    const tenantId = requireTenantId(context);
    const qb = scopedEntries(this.dataSource.manager, context);
    applyFilters(qb, query);
    const page = await keysetPage(qb, {
      alias: KB_ALIAS,
      property: 'createdAt',
      direction: query.sort === 'createdAt' ? 'ASC' : 'DESC',
      cursor: query.cursor,
      limit: query.limit,
    });
    const units = restrictedUnitIds(context, tenantId);
    return listResponse(
      await this.views(this.dataSource.manager, context, page.items),
      page.nextCursor,
      { tenantId, ...(units ? { unitIds: units } : {}) },
    );
  }

  async get(context: RequestContext, id: string): Promise<RcaKnowledgeV2View> {
    const entry = await findEntry(this.dataSource.manager, context, id);
    const [view] = await this.views(this.dataSource.manager, context, [entry]);
    return view;
  }

  /** Views of `entries` in their order, with the page's details loaded in bulk. */
  async views(
    manager: EntityManager,
    context: RequestContext,
    entries: RCAKnowledgeBase[],
  ): Promise<RcaKnowledgeV2View[]> {
    if (entries.length === 0) return [];
    const details = await loadKnowledgeDetails(manager, {
      tenantId: requireTenantId(context),
      userId: context.userId,
      entries,
    });
    return entries.map((entry) => {
      const found = details.get(entry.id);
      if (!found) throw new Error(`details missing for entry ${entry.id}`);
      return toKnowledgeView(entry, found);
    });
  }
}

/** An entry of the caller's tenant and units, locked when `lock`; 404 for anything else. */
export async function findEntry(
  manager: EntityManager,
  context: RequestContext,
  id: string,
  lock = false,
): Promise<RCAKnowledgeBase> {
  const qb = scopedEntries(manager, context).andWhere('kb.id = :id', { id });
  if (lock) qb.setLock('pessimistic_write');
  const found = await qb.getOne();
  if (!found) throw knowledgeNotFound();
  return found;
}

export function knowledgeNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'NOT_FOUND',
    message: 'Knowledge entry not found',
  });
}
