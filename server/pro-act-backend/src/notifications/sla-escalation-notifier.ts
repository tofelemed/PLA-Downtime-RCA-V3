import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { QUEUE_WINDOW_DAYS } from '../close/reconciliation-queue.service';
import { slaPeriodsCte, SqlParams } from '../close/sla-sql';
import { WorkflowPoliciesService } from '../close/workflow-policies.service';
import { enqueueOutbox } from '../common/outbox/outbox-writer';
import {
  EscalationNotice,
  escalationNotices,
} from '../domain/close/escalation-notices';
import { ReconciliationSlaPolicy } from '../domain/close/sla-policy';
import { roleHoldersOf } from './role-holders';

interface EscalatedRow {
  id: string;
  unit_id: string;
  unit_name: string | null;
  plan_id: string | null;
  local_date: string;
  shift_name: string | null;
  rev_id: string | null;
  escalation_level: number;
  rejection_escalated: boolean;
  rejections: number;
}

interface NotificationRow {
  user_id: string;
  dedupe_key: string;
  entity_id: string;
  detail: Record<string, unknown>;
}

/** Outbox type of the realtime hint: the client refetches its own notifications (no content is pushed). */
export const NOTIFICATIONS_CREATED = 'UserNotificationsCreated';

function detailOf(
  row: EscalatedRow,
  notice: EscalationNotice,
  asOf: Date,
): Record<string, unknown> {
  return {
    reason: notice.reason,
    role: notice.role,
    level: notice.level,
    afterHours: notice.afterHours,
    rejections: notice.rejections,
    periodId: row.id,
    unitId: row.unit_id,
    unitName: row.unit_name,
    planId: row.plan_id,
    localDate: row.local_date,
    shiftName: row.shift_name,
    escalatedAt: asOf.toISOString(),
  };
}

/**
 * SLA escalation notifications (SME R3 / R6, EXPERT_REVIEW Area 3): for one plant, the ended, not approved
 * periods of the queue window that reached an escalation (48 h → production accounting, 72 h → plant
 * management, the 3rd rejection of a revision → production accounting, as the `reconciliation_sla` policy in
 * force says) give one in-app notification per holder of the escalation role in the plant — per period and
 * level, or per revision for rejections. Idempotent: `UQ_user_notifications_user_key` and ON CONFLICT DO
 * NOTHING, so a rerun (or a second worker) adds nothing. New rows publish one realtime hint per plant.
 */
@Injectable()
export class SlaEscalationNotifier {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly policies: WorkflowPoliciesService,
  ) {}

  /** Notifications created for the plant at `asOf`. */
  notify(tenantId: string, asOf: Date): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const { policy } = await this.policies.sla(manager, tenantId, asOf);
      const periods = await this.escalated(manager, tenantId, asOf, policy);
      const rows = await this.rowsFor(manager, tenantId, periods, {
        policy,
        asOf,
      });
      const created = await this.insert(manager, tenantId, rows);
      if (created > 0) {
        await enqueueOutbox(manager, [
          {
            tenantId,
            aggregateType: 'user_notification',
            aggregateId: tenantId,
            type: NOTIFICATIONS_CREATED,
            payload: { tenantId, created },
          },
        ]);
      }
      return created;
    });
  }

  private escalated(
    manager: EntityManager,
    tenantId: string,
    asOf: Date,
    policy: ReconciliationSlaPolicy,
  ): Promise<EscalatedRow[]> {
    const params = new SqlParams();
    const since = new Date(asOf.getTime() - QUEUE_WINDOW_DAYS * 86_400_000);
    const where = `p."tenant_id" = ${params.add(tenantId)} AND p."local_date" >= ${params.add(
      since.toISOString().slice(0, 10),
    )}::date AND NOT (p."is_excluded" AND r."id" IS NULL)`;
    const cte = slaPeriodsCte(params, { where, asOf, policy });
    const at = params.add(asOf);
    return manager.query(
      `${cte}
       SELECT s."id", s."unit_id", u."name" AS "unit_name", pv."plan_id"::text AS "plan_id",
              to_char(s."local_date", 'YYYY-MM-DD') AS "local_date", s."shift_name", s."rev_id"::text AS "rev_id",
              s."escalation_level", s."rejection_escalated", s."rejections"
         FROM s LEFT JOIN "units" u ON u."id" = s."unit_id"
         LEFT JOIN "plan_versions" pv ON pv."id" = s."selected_plan_version_id"
        WHERE s."workflow" <> 'approved' AND s."day_end" <= ${at}::timestamptz
          AND (s."escalation_level" > 0 OR s."rejection_escalated")
        ORDER BY s."local_date", s."id"`,
      params.values,
    );
  }

  /** One row per notice and holder of its role for the period's unit (holders cached per role and unit). */
  private async rowsFor(
    manager: EntityManager,
    tenantId: string,
    periods: readonly EscalatedRow[],
    at: { policy: ReconciliationSlaPolicy; asOf: Date },
  ): Promise<NotificationRow[]> {
    const holders = new Map<string, string[]>();
    const rows: NotificationRow[] = [];
    for (const period of periods) {
      const notices = escalationNotices(
        {
          periodId: period.id,
          revisionId: period.rev_id,
          escalationLevel: period.escalation_level,
          rejectionEscalated: period.rejection_escalated,
          rejections: period.rejections,
        },
        at.policy,
      );
      for (const notice of notices) {
        const key = `${notice.role}:${period.unit_id}`;
        const users =
          holders.get(key) ??
          (await roleHoldersOf(manager, {
            tenantId,
            role: notice.role,
            unitId: period.unit_id,
          }));
        holders.set(key, users);
        const detail = detailOf(period, notice, at.asOf);
        for (const userId of users) {
          rows.push({
            user_id: userId,
            dedupe_key: notice.dedupeKey,
            entity_id: period.id,
            detail,
          });
        }
      }
    }
    return rows;
  }

  private async insert(
    manager: EntityManager,
    tenantId: string,
    rows: readonly NotificationRow[],
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const inserted: unknown[] = await manager.query(
      `INSERT INTO "user_notifications" ("tenant_id", "row_version", "user_id", "kind", "dedupe_key",
              "entity_type", "entity_id", "detail")
       SELECT $1, 1, x."user_id", 'sla_escalation', x."dedupe_key", 'production_period', x."entity_id", x."detail"
         FROM jsonb_to_recordset($2::jsonb) AS x("user_id" uuid, "dedupe_key" text, "entity_id" uuid, "detail" jsonb)
       ON CONFLICT ("tenant_id", "user_id", "dedupe_key") DO NOTHING
       RETURNING "id"`,
      [tenantId, JSON.stringify(rows)],
    );
    return inserted.length;
  }
}
