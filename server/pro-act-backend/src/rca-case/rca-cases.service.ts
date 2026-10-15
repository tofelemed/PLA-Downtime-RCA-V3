import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { assertRevision } from '../common/concurrency/revision';
import { RequestContext } from '../common/context/request-context';
import { RCA } from '../rca/rca.entity';
import { keysetPage } from '../v2/common/keyset-page';
import { listResponse, ListResponse } from '../v2/common/response';
import {
  RcaCaseV2CreateDto,
  RcaCaseV2ListQueryDto,
  RcaCaseV2UpdateDto,
} from '../v2/rca/rca-cases-v2.dto';
import {
  statusOf,
  TEAM_LOCKED_STATUSES,
  withInvestigators,
} from '../domain/rca/case-workflow';
import { readIds } from './rca-case-json';
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
import { findCase, invalidBody, scopeOf } from './rca-scope';

/** target close date passed while the case is not closed */
export const OVERDUE = `(rca.target_completion_date IS NOT NULL AND rca.target_completion_date < now() AND rca.status IS DISTINCT FROM 'Closed')`;

const LINKED_EVENT = (condition: string) =>
  `EXISTS (SELECT 1 FROM "rca_case_links" k JOIN "production_events" e ON e."id"::text = k."target_id"
     WHERE k."rca_id" = rca.id AND k."tenant_id" = rca.tenant_id AND k."link_type" = 'event' AND ${condition})`;

/**
 * v2 RCA cases (plan 3.9 step 1): tenant and unit scope from identity, keyset lists with server-side
 * search (status, unit, asset / reason / window of linked events, title), ETag reads and If-Match edits
 * that persist the nested content. The status never comes from a body: moves go through
 * `RcaCaseWorkflowService` (RCA-01).
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
    if (query.priority)
      qb.andWhere('rca.priority = :priority', { priority: query.priority });
    if (query.overdue !== undefined)
      qb.andWhere(query.overdue ? OVERDUE : `NOT (${OVERDUE})`);
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
      if (body.status !== undefined && body.status !== statusOf(rca.status)) {
        throw invalidBody(
          'STATUS_VIA_TRANSITION',
          'status',
          'the status changes through POST /v2/rcas/{id}/transitions (the case workflow), not by an edit',
        );
      }
      assertTeamOpen(rca, body);
      await assertCaseReferences(manager, scope, body, unitId);
      await manager.getRepository(RCA).save({
        ...rca,
        ...caseColumns(body),
        investigatorIds: withInvestigators(rca.investigatorIds, [
          rca.teamLeadId,
          ...readIds(rca.teamMemberIds),
          body.teamLeadId,
          ...(body.teamMemberIds ?? []),
        ]),
      });
    });
    return this.get(context, target.id);
  }
}

/**
 * CA1: once the investigation is accepted (Monitoring, Closure Review, Closed) the team is frozen — nobody
 * joins or leaves it, so the closure approver's independence is judged on a fixed team (422 TEAM_LOCKED).
 */
function assertTeamOpen(rca: RCA, body: RcaCaseV2UpdateDto): void {
  if (!TEAM_LOCKED_STATUSES.includes(statusOf(rca.status))) return;
  const leadChanged =
    body.teamLeadId !== undefined &&
    body.teamLeadId !== (rca.teamLeadId ?? null);
  const current = readIds(rca.teamMemberIds);
  const membersChanged =
    body.teamMemberIds !== undefined &&
    (body.teamMemberIds.length !== current.length ||
      body.teamMemberIds.some((id) => !current.includes(id)));
  if (!leadChanged && !membersChanged) return;
  throw invalidBody(
    'TEAM_LOCKED',
    leadChanged ? 'teamLeadId' : 'teamMemberIds',
    'the investigation team is fixed once the investigation is accepted (reopen the case to change it)',
  );
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}
