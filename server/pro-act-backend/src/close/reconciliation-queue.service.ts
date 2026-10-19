import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { satisfiesRole } from '../auth/roles/role-model';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { restrictedUnitIds } from '../common/query/scoped-query';
import { ReconciliationSlaPolicy } from '../domain/close/sla-policy';
import { CursorCodec, invalidCursor } from '../v2/common/cursor-codec';
import { PERIOD_WRITERS, REVISION_APPROVERS } from '../v2/periods/period-roles';
import { planCoveredSql } from './plan-coverage-sql';
import { slaPeriodsCte, SqlParams } from './sla-sql';
import { WorkflowPoliciesService } from './workflow-policies.service';

/** How far back the queue looks (operational dates); older open periods show in the status report. */
export const QUEUE_WINDOW_DAYS = 62;

export type QueueTask = 'prepare' | 'review' | 'escalated';

export interface QueueRow {
  id: string;
  unit_id: string;
  unit_name: string | null;
  plan_id: string | null;
  local_date: string;
  shift_name: string | null;
  utc_start: Date;
  utc_end: Date;
  workflow: string;
  revision: number | null;
  task: QueueTask;
  due: Date;
  overdue: boolean;
  escalation_level: number;
  on_hold: boolean;
  rejections: number;
  rejection_escalated: boolean;
}

export interface QueuePage {
  rows: QueueRow[];
  nextCursor: string | null;
  policy: ReconciliationSlaPolicy;
  asOf: Date;
}

/** What the caller's roles let them act on (SME R3 / R6). */
interface QueueRoles {
  prepare: boolean;
  review: boolean;
  /** lowest escalation level whose role the caller holds; null = none */
  escalationFrom: number | null;
  rejections: boolean;
}

function rolesOf(
  context: RequestContext,
  policy: ReconciliationSlaPolicy,
): QueueRoles {
  const holds = (role: string) => satisfiesRole(context.roles, role);
  const level = policy.escalations.findIndex((step) => holds(step.role));
  return {
    prepare: PERIOD_WRITERS.some(holds),
    review: REVISION_APPROVERS.some(holds),
    escalationFrom: level >= 0 ? level + 1 : null,
    rejections: holds(policy.rejectionEscalationRole),
  };
}

const iso = (value: Date | string) => new Date(value).toISOString();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * "My queue" (SME R3 / R6): the ended, not approved periods of the last `QUEUE_WINDOW_DAYS` the caller can
 * act on — to prepare (draft or never reconciled), to review (submitted by someone else), or escalated to
 * one of their roles — earliest due first; periods no approved plan covers wait for a plan instead
 * (owner decision 2026-10-19) (keyset on due time and id), with the SLA columns computed in SQL.
 */
@Injectable()
export class ReconciliationQueueService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly policies: WorkflowPoliciesService,
  ) {}

  async page(
    context: RequestContext,
    query: { cursor?: string; limit: number },
  ): Promise<QueuePage> {
    const tenantId = requireTenantId(context);
    const asOf = new Date();
    const { policy } = await this.policies.sla(
      this.dataSource.manager,
      tenantId,
      asOf,
    );
    const params = new SqlParams();
    const cte = slaPeriodsCte(params, {
      where: this.scopeWhere(params, context, tenantId, asOf),
      asOf,
      policy,
    });
    const task = this.taskSql(params, rolesOf(context, policy), context);
    const after = this.afterSql(params, query.cursor);
    const asOfParam = params.add(asOf);
    const rows: QueueRow[] = await this.dataSource.query(
      `${cte}, t AS (SELECT s.*, ${task} AS "task" FROM s
                      WHERE s."workflow" <> 'approved' AND s."day_end" <= ${asOfParam}::timestamptz)
       SELECT t.*, u."name" AS "unit_name", pv."plan_id"::text AS "plan_id",
              to_char(t."local_date", 'YYYY-MM-DD') AS "local_date"
         FROM t LEFT JOIN "units" u ON u."id" = t."unit_id"
         LEFT JOIN "plan_versions" pv ON pv."id" = t."selected_plan_version_id"
        WHERE t."task" IS NOT NULL ${after}
        ORDER BY t."due" ASC, t."id" ASC LIMIT ${query.limit + 1}`,
      params.values,
    );
    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];
    return {
      rows: page,
      nextCursor:
        rows.length > query.limit && last
          ? CursorCodec.encode({ sortValue: iso(last.due), id: last.id })
          : null,
      policy,
      asOf,
    };
  }

  private scopeWhere(
    params: SqlParams,
    context: RequestContext,
    tenantId: string,
    asOf: Date,
  ): string {
    const since = new Date(asOf.getTime() - QUEUE_WINDOW_DAYS * 86_400_000);
    const tenant = params.add(tenantId);
    const from = params.add(since.toISOString().slice(0, 10));
    const units = restrictedUnitIds(context, tenantId);
    const unitFilter = units
      ? ` AND p."unit_id" = ANY(${params.add(units)}::uuid[])`
      : '';
    return `p."tenant_id" = ${tenant} AND p."local_date" >= ${from}::date${unitFilter}
            AND NOT (p."is_excluded" AND r."id" IS NULL) AND ${planCoveredSql('p')}`;
  }

  private taskSql(
    params: SqlParams,
    roles: QueueRoles,
    context: RequestContext,
  ): string {
    const user = params.add(context.userId);
    const escalation =
      roles.escalationFrom === null
        ? 'false'
        : `s."escalation_level" >= ${params.add(roles.escalationFrom)}::int`;
    return `CASE
      WHEN ${escalation} THEN 'escalated'
      WHEN ${roles.rejections} AND s."rejection_escalated" THEN 'escalated'
      WHEN ${roles.review} AND s."workflow" IN ('in_review', 'stale')
           AND s."submitted_by" IS DISTINCT FROM ${user}::uuid THEN 'review'
      WHEN ${roles.prepare} AND s."workflow" IN ('none', 'draft') THEN 'prepare'
    END`;
  }

  private afterSql(params: SqlParams, cursor: string | undefined): string {
    if (!cursor) return '';
    const decoded = CursorCodec.decode(cursor);
    const valid =
      typeof decoded.sortValue === 'string' &&
      !Number.isNaN(Date.parse(decoded.sortValue)) &&
      UUID.test(decoded.id);
    if (!valid) throw invalidCursor();
    const due = params.add(decoded.sortValue);
    const id = params.add(decoded.id);
    return `AND (t."due", t."id") > (${due}::timestamptz, ${id}::uuid)`;
  }
}
