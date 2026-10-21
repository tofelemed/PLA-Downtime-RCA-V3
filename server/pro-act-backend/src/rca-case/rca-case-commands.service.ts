import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { assertRevision } from '../common/concurrency/revision';
import { RequestContext } from '../common/context/request-context';
import { RCA } from '../rca/rca.entity';
import { actionOverdueSql } from './action-overdue';
import { caseAudit, recordRcaAudit } from './rca-audit';
import { writeJson } from './rca-case-json';
import {
  evidenceOptions,
  RcaEvidenceOptionsV2View,
} from './rca-evidence-options';
import { templateLogicTree } from './rca-case-template';
import { RcaCaseV2View } from './rca-case.view';
import { OVERDUE, RcaCasesService } from './rca-cases.service';
import { findCase, invalidBody, scopeOf } from './rca-scope';
import { assertCaseNotClosed } from './case-closed';

/** Counts of the cases in the caller's scope (the RCA list header and the dashboard tiles). */
export interface RcaCaseSummaryV2View {
  total: number;
  /** cases not closed */
  open: number;
  overdue: number;
  critical: number;
  /** open or in-progress actions past their due date */
  overdueActions: number;
  /** actions with a baseline and a verification window whose effectiveness result is not in yet */
  effectivenessPending: number;
  byStatus: Array<{ status: string | null; count: number }>;
  asOf: string;
}

const USES = [
  `SELECT 1 FROM "rca_case_links" WHERE "rca_id" = $1`,
  `SELECT 1 FROM "rca_actions" WHERE "rca_id" = $1`,
  `SELECT 1 FROM "rca_trigger_evaluations" WHERE "rca_id" = $1`,
  `SELECT 1 FROM "rca_knowledge_base" WHERE "rca_id" = $1`,
];

async function isReferenced(
  manager: EntityManager,
  id: string,
): Promise<boolean> {
  for (const sql of USES) {
    const rows: unknown[] = await manager.query(`${sql} LIMIT 1`, [id]);
    if (rows.length > 0) return true;
  }
  return false;
}

/**
 * Case commands beside the edit (plan 3.9 follow-up, v1 parity): the list summary, deleting a case that
 * nothing refers to yet, and resetting the logic tree to the case's template.
 */
@Injectable()
export class RcaCaseCommandsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cases: RcaCasesService,
  ) {}

  async summary(context: RequestContext): Promise<RcaCaseSummaryV2View> {
    const scope = scopeOf(context);
    const rows: Array<{
      status: string | null;
      count: string;
      overdue: string;
      critical: string;
    }> = await this.dataSource.query(
      `SELECT rca.status, count(*) AS count,
                count(*) FILTER (WHERE ${OVERDUE}) AS overdue,
                count(*) FILTER (WHERE rca.priority = 'Critical' AND rca.status IS DISTINCT FROM 'Closed') AS critical
           FROM "rcas" rca
          WHERE rca.tenant_id = $1 AND ($2::uuid[] IS NULL OR rca.unit_id = ANY($2::uuid[]))
          GROUP BY rca.status ORDER BY rca.status`,
      [scope.tenantId, scope.units],
    );
    const sum = (pick: (row: (typeof rows)[number]) => string) =>
      rows.reduce((total, row) => total + Number(pick(row)), 0);
    const closed = rows.find((row) => row.status === 'Closed');
    const actions = await this.actionCounts(scope.tenantId, scope.units);
    return {
      total: sum((row) => row.count),
      open: sum((row) => row.count) - Number(closed?.count ?? 0),
      ...actions,
      overdue: sum((row) => row.overdue),
      critical: sum((row) => row.critical),
      byStatus: rows.map((row) => ({
        status: row.status,
        count: Number(row.count),
      })),
      asOf: new Date().toISOString(),
    };
  }

  private async actionCounts(
    tenantId: string,
    units: string[] | null,
  ): Promise<{ overdueActions: number; effectivenessPending: number }> {
    const [row]: Array<{ overdue: number; pending: number }> =
      await this.dataSource.query(
        `SELECT count(*) FILTER (WHERE ${actionOverdueSql('a')})::int AS overdue,
                count(*) FILTER (WHERE a.baseline IS NOT NULL AND a.post_action IS NULL
                                   AND a.verification_window_end IS NOT NULL AND a.status::text <> 'cancelled')::int AS pending
           FROM "rca_actions" a JOIN "rcas" rca ON rca.id = a.rca_id
          WHERE rca.tenant_id = $1 AND ($2::uuid[] IS NULL OR rca.unit_id = ANY($2::uuid[]))`,
        [tenantId, units],
      );
    return {
      overdueActions: row?.overdue ?? 0,
      effectivenessPending: row?.pending ?? 0,
    };
  }

  /** Pick lists of the evidence form (tenant evidence categories and locations). */
  evidenceOptions(context: RequestContext): Promise<RcaEvidenceOptionsV2View> {
    return evidenceOptions(this.dataSource.manager, scopeOf(context).tenantId);
  }

  /** 409 CASE_CLOSED for a closed case; 409 RCA_CASE_IN_USE once it is linked, has actions or a recommendation points at it. */
  async remove(
    context: RequestContext,
    target: { id: string; expectedRowVersion: number },
  ): Promise<void> {
    const scope = scopeOf(context);
    await this.dataSource.transaction(async (manager) => {
      const rca = await findCase(manager, scope, target.id, true);
      assertCaseNotClosed(rca);
      assertRevision(rca.rowVersion, target.expectedRowVersion);
      if (await isReferenced(manager, rca.id)) {
        throw new ConflictException({
          code: 'RCA_CASE_IN_USE',
          message:
            'Only an open case without links, actions or recommendations can be deleted',
        });
      }
      await manager
        .getRepository(RCA)
        .delete({ id: rca.id, tenantId: scope.tenantId });
      await recordRcaAudit(manager, scope, [
        caseAudit('deleted', { before: rca, after: null }),
      ]);
    });
  }

  /** Replaces the logic tree with a fresh copy of the case's template (422 NO_TEMPLATE without one). */
  async resetLogicTree(
    context: RequestContext,
    target: { id: string; expectedRowVersion: number },
  ): Promise<RcaCaseV2View> {
    const scope = scopeOf(context);
    await this.dataSource.transaction(async (manager) => {
      const rca = await findCase(manager, scope, target.id, true);
      assertCaseNotClosed(rca);
      assertRevision(rca.rowVersion, target.expectedRowVersion);
      if (!rca.templateId) {
        throw invalidBody(
          'NO_TEMPLATE',
          'templateId',
          'the case was not opened from a template',
        );
      }
      const tree = await templateLogicTree(
        manager,
        scope.tenantId,
        rca.templateId,
      );
      const saved = await manager
        .getRepository(RCA)
        .save({ ...rca, logicTree: writeJson(tree) });
      await recordRcaAudit(manager, scope, [
        caseAudit('logic_tree_reset', { before: rca, after: saved }),
      ]);
    });
    return this.cases.get(context, target.id);
  }
}
