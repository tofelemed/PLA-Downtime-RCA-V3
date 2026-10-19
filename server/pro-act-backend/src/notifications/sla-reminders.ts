import { EntityManager } from 'typeorm';
import { QUEUE_WINDOW_DAYS } from '../close/reconciliation-queue.service';
import { slaPeriodsCte, SqlParams } from '../close/sla-sql';
import { planCoveredSql } from '../close/plan-coverage-sql';
import { DueReminder, dueReminder } from '../domain/close/due-reminders';
import { ReconciliationSlaPolicy } from '../domain/close/sla-policy';
import { REVISION_APPROVERS } from '../v2/periods/period-roles';
import {
  HolderCache,
  NotificationRow,
  PeriodRef,
  periodDetail,
} from './notification-rows';

/**
 * SME R1: operations / production accounting prepare; when nobody has worked on the period yet, the
 * reminder goes to production accounting of the unit.
 */
export const DEFAULT_PREPARER_ROLE = 'production_accountant';

interface DueRow extends PeriodRef {
  rev_id: string | null;
  workflow: string;
  rejections: number;
  due: Date;
  /** last submitter of the current revision, else whoever opened it — an active user (null = nobody / the system) */
  preparer_id: string | null;
}

function dueRows(
  manager: EntityManager,
  tenantId: string,
  at: { asOf: Date; policy: ReconciliationSlaPolicy },
): Promise<DueRow[]> {
  const params = new SqlParams();
  const since = new Date(at.asOf.getTime() - QUEUE_WINDOW_DAYS * 86_400_000);
  const where = `p."tenant_id" = ${params.add(tenantId)} AND p."local_date" >= ${params.add(
    since.toISOString().slice(0, 10),
  )}::date AND NOT (p."is_excluded" AND r."id" IS NULL) AND ${planCoveredSql('p')}`;
  const cte = slaPeriodsCte(params, { where, ...at });
  return manager.query(
    `${cte}
     SELECT s."id", s."unit_id", u."name" AS "unit_name", pv."plan_id"::text AS "plan_id",
            to_char(s."local_date", 'YYYY-MM-DD') AS "local_date", s."shift_name", s."rev_id"::text AS "rev_id",
            s."workflow", s."rejections", s."due", pu."id"::text AS "preparer_id"
       FROM s LEFT JOIN "units" u ON u."id" = s."unit_id"
       LEFT JOIN "plan_versions" pv ON pv."id" = s."selected_plan_version_id"
       LEFT JOIN "accounting_revisions" ar ON ar."id" = s."rev_id"
       LEFT JOIN LATERAL (SELECT a."actor_id" FROM "approval_actions" a
                           WHERE a."revision_id" = s."rev_id" AND a."action" = 'submit' AND a."actor_id" IS NOT NULL
                           ORDER BY a."created_at" DESC LIMIT 1) sub ON true
       LEFT JOIN "users" pu ON pu."id" = coalesce(sub."actor_id", ar."created_by")
                           AND pu."is_active" IS DISTINCT FROM false
      WHERE s."overdue" AND s."workflow" <> 'approved'
      ORDER BY s."local_date", s."id"`,
    params.values,
  );
}

/**
 * Preparer: the named person (last submitter, else who opened the revision), else production accounting of
 * the unit. Checker: every holder of a revision-approver role of the unit except the preparer (SME R1 /
 * D06: the submitter never checks their own work).
 */
async function recipientsOf(
  row: DueRow,
  reminder: DueReminder,
  holders: HolderCache,
): Promise<string[]> {
  if (reminder.recipient === 'preparer') {
    return row.preparer_id
      ? [row.preparer_id]
      : holders.of(DEFAULT_PREPARER_ROLE, row.unit_id);
  }
  const checkers = new Set<string>();
  for (const role of REVISION_APPROVERS) {
    for (const user of await holders.of(role, row.unit_id)) checkers.add(user);
  }
  if (row.preparer_id) checkers.delete(row.preparer_id);
  return [...checkers].sort();
}

/**
 * SME R3 due reminders of one plant at `asOf`: one `sla_reminder` row per recipient of every period whose
 * current stage is past due (not on a data hold), keyed per period, stage and submission cycle.
 */
export async function dueReminderRows(
  manager: EntityManager,
  tenantId: string,
  at: { asOf: Date; policy: ReconciliationSlaPolicy; holders: HolderCache },
): Promise<NotificationRow[]> {
  const rows: NotificationRow[] = [];
  const periods = await dueRows(manager, tenantId, at);
  for (const period of periods) {
    const reminder = dueReminder({
      periodId: period.id,
      revisionId: period.rev_id,
      workflow: period.workflow,
      overdue: true,
      rejections: period.rejections,
    });
    if (!reminder) continue;
    const detail = {
      reason: 'due',
      stage: reminder.stage,
      recipient: reminder.recipient,
      dueAt: new Date(period.due).toISOString(),
      ...periodDetail(period),
      remindedAt: at.asOf.toISOString(),
    };
    for (const userId of await recipientsOf(period, reminder, at.holders)) {
      rows.push({
        user_id: userId,
        kind: 'sla_reminder',
        dedupe_key: reminder.dedupeKey,
        entity_id: period.id,
        detail,
      });
    }
  }
  return rows;
}
