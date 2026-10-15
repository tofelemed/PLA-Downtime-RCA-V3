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
import {
  HolderCache,
  insertNotifications,
  NotificationRow,
  PeriodRef,
  periodDetail,
} from './notification-rows';
import { roleHoldersOf } from './role-holders';
import { dueReminderRows } from './sla-reminders';

interface EscalatedRow extends PeriodRef {
  rev_id: string | null;
  escalation_level: number;
  rejection_escalated: boolean;
  rejections: number;
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
    ...periodDetail(row),
    escalatedAt: asOf.toISOString(),
  };
}

/**
 * SLA notifications (SME R3 / R6, EXPERT_REVIEW Area 3). Due reminders first: a period whose current stage
 * is past due tells its preparer (submission) or its checkers (approval) once per stage and submission cycle
 * (`sla_reminder`, see `dueReminderRows`). Escalations: for one plant, the ended, not approved
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
      const holders = new HolderCache((role, unitId) =>
        roleHoldersOf(manager, { tenantId, role, unitId }),
      );
      const reminders = await dueReminderRows(manager, tenantId, {
        asOf,
        policy,
        holders,
      });
      const periods = await this.escalated(manager, tenantId, asOf, policy);
      const escalations = await this.rowsFor(periods, {
        policy,
        asOf,
        holders,
      });
      const created = await insertNotifications(manager, tenantId, [
        ...reminders,
        ...escalations,
      ]);
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
    periods: readonly EscalatedRow[],
    at: { policy: ReconciliationSlaPolicy; asOf: Date; holders: HolderCache },
  ): Promise<NotificationRow[]> {
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
        const users = await at.holders.of(notice.role, period.unit_id);
        const detail = detailOf(period, notice, at.asOf);
        for (const userId of users) {
          rows.push({
            user_id: userId,
            kind: 'sla_escalation',
            dedupe_key: notice.dedupeKey,
            entity_id: period.id,
            detail,
          });
        }
      }
    }
    return rows;
  }
}
