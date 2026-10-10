import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { assertRevision } from '../common/concurrency/revision';
import { RequestContext } from '../common/context/request-context';
import { actorFromContext } from '../production-event/revisions/revision-actor';
import { RCA } from '../rca/rca.entity';
import { keysetPage } from '../v2/common/keyset-page';
import { listResponse, ListResponse } from '../v2/common/response';
import {
  RcaCaseV2CreateDto,
  RcaCaseV2ListQueryDto,
  RcaCaseV2UpdateDto,
} from '../v2/rca/rca-cases-v2.dto';
import { moveEventRcaState } from './event-rca-pointer';
import {
  assertCaseReferences,
  caseColumns,
  insertCase,
} from './rca-case-writer';
import {
  RcaCaseSummaryV2View,
  RcaCaseV2View,
  toRcaCaseSummary,
  toRcaCaseView,
} from './rca-case.view';
import { upsertKnowledgeEntry } from './rca-knowledge';
import { findCase, RcaScope, scopeOf } from './rca-scope';

const LINKED_EVENT = (condition: string) =>
  `EXISTS (SELECT 1 FROM "rca_case_links" k JOIN "production_events" e ON e."id"::text = k."target_id"
     WHERE k."rca_id" = rca.id AND k."tenant_id"::text = rca.tenant_id AND k."link_type" = 'event' AND ${condition})`;

/**
 * v2 RCA cases (plan 3.9 step 1): tenant and unit scope from identity, keyset lists with server-side
 * search (status, unit, asset / reason / window of linked events, title), ETag reads, If-Match edits
 * that persist the nested content, and the close transition (knowledge entry, linked events completed).
 */
@Injectable()
export class RcaCasesService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async list(
    context: RequestContext,
    query: RcaCaseV2ListQueryDto,
  ): Promise<ListResponse<RcaCaseSummaryV2View>> {
    const scope = scopeOf(context);
    const qb = this.dataSource
      .getRepository(RCA)
      .createQueryBuilder('rca')
      .where('rca.tenantId = :tenantId', { tenantId: scope.tenantId });
    if (scope.units)
      qb.andWhere('rca.unitId = ANY(:units::uuid[])', { units: scope.units });
    if (query.status)
      qb.andWhere('rca.status = :status', { status: query.status });
    if (query.unitId)
      qb.andWhere('rca.unitId = :unitId', { unitId: query.unitId });
    if (query.q)
      qb.andWhere('rca.title ILIKE :q', { q: `%${escapeLike(query.q)}%` });
    if (query.assetId)
      qb.andWhere(
        `(rca.assetId = :assetId OR ${LINKED_EVENT('e."asset_id" = :assetId')})`,
        {
          assetId: query.assetId,
        },
      );
    if (query.reasonCodeId)
      qb.andWhere(LINKED_EVENT('e."reason_code_id" = :reasonCodeId'), {
        reasonCodeId: query.reasonCodeId,
      });
    if (query.from || query.to)
      qb.andWhere(
        LINKED_EVENT(
          `(:from::timestamptz IS NULL OR e."end_time" IS NULL OR e."end_time" > :from) AND (:to::timestamptz IS NULL OR e."start_time" < :to)`,
        ),
        { from: query.from ?? null, to: query.to ?? null },
      );
    const page = await keysetPage(qb, {
      alias: 'rca',
      property: 'createdAt',
      direction: query.sort === 'createdAt' ? 'ASC' : 'DESC',
      cursor: query.cursor,
      limit: query.limit,
    });
    return listResponse(page.items.map(toRcaCaseSummary), page.nextCursor, {
      tenantId: scope.tenantId,
      ...(scope.units ? { unitIds: scope.units } : {}),
    });
  }

  async get(context: RequestContext, id: string): Promise<RcaCaseV2View> {
    return toRcaCaseView(
      await findCase(this.dataSource.manager, scopeOf(context), id),
    );
  }

  async create(
    context: RequestContext,
    body: RcaCaseV2CreateDto,
  ): Promise<RcaCaseV2View> {
    const scope = scopeOf(context);
    const saved = await this.dataSource.transaction((manager) =>
      insertCase(manager, scope, body),
    );
    return this.get(context, saved.id);
  }

  async update(
    context: RequestContext,
    target: { id: string; expectedRowVersion: number },
    body: RcaCaseV2UpdateDto,
  ): Promise<RcaCaseV2View> {
    const scope = scopeOf(context);
    await this.dataSource.transaction(async (manager) => {
      const rca = await findCase(manager, scope, target.id, true);
      assertRevision(rca.rowVersion, target.expectedRowVersion);
      const unitId =
        body.unitId === undefined ? (rca.unitId ?? null) : body.unitId;
      await assertCaseReferences(manager, scope, body, unitId);
      const closing = body.status === 'Closed' && rca.status !== 'Closed';
      const columns = caseColumns(body);
      if (closing && !body.actualCloseDate)
        columns.actualCloseDate = new Date();
      await manager.getRepository(RCA).save({ ...rca, ...columns });
      if (closing) await this.onClosed(manager, scope, context, target.id);
    });
    return this.get(context, target.id);
  }

  /** Knowledge entry and `completed` RCA state of every linked event (a person closed the case). */
  private async onClosed(
    manager: EntityManager,
    scope: RcaScope,
    context: RequestContext,
    id: string,
  ): Promise<void> {
    const rca = await findCase(manager, scope, id);
    await upsertKnowledgeEntry(manager, {
      rca,
      closedBy: scope.userId,
      closedAt: rca.actualCloseDate ?? new Date(),
    });
    const events: Array<{ target_id: string }> = await manager.query(
      `SELECT "target_id" FROM "rca_case_links" WHERE "tenant_id" = $1 AND "rca_id" = $2 AND "link_type" = 'event'`,
      [scope.tenantId, id],
    );
    for (const { target_id: eventId } of events) {
      await moveEventRcaState(manager, {
        eventId,
        tenantId: scope.tenantId,
        rcaId: id,
        state: 'completed',
        actor: actorFromContext(context),
      });
    }
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}
