import { EntityManager } from 'typeorm';
import {
  WorkItemKind,
  WorkNotice,
  workItemNotices,
  WorkTimings,
} from '../domain/notifications/work-reminders';
import { NotificationRow } from './notification-rows';
import { plantMembersOf } from './plant-members';

interface WorkItemRow {
  id: string;
  title: string;
  rca_id: string | null;
  case_title: string | null;
  assignee_id: string | null;
  /** case team lead of an action, assigner of a task */
  escalation_id: string | null;
  due: Date;
}

/** Open corrective actions due inside the window (IDX_rca_actions_tenant_due). */
const ACTIONS_SQL = `SELECT a."id"::text AS "id", a."title", a."rca_id"::text AS "rca_id", r."title" AS "case_title",
       a."owner_id"::text AS "assignee_id", r."team_lead_id"::text AS "escalation_id", a."due_date" AS "due"
  FROM "rca_actions" a JOIN "rcas" r ON r."id" = a."rca_id"
 WHERE a."tenant_id" = $1 AND a."due_date" >= $2 AND a."due_date" <= $3
   AND a."status" IN ('open', 'in_progress')
 ORDER BY a."due_date", a."id"`;

/** Open tasks due inside the window (IDX_tasks_tenant_due). */
const TASKS_SQL = `SELECT t."id"::text AS "id", t."title", NULL AS "rca_id", NULL AS "case_title",
       t."assigned_to" AS "assignee_id", t."assigned_by" AS "escalation_id", t."due_date" AS "due"
  FROM "tasks" t
 WHERE t."tenant_id" = $1 AND t."due_date" >= $2 AND t."due_date" <= $3
   AND t."status" NOT IN ('Completed', 'Cancelled')
 ORDER BY t."due_date", t."id"`;

const LABEL: Readonly<Record<WorkItemKind, string>> = {
  rca_action: 'Corrective action',
  task: 'Task',
};

function messageOf(kind: WorkItemKind, notice: WorkNotice): string {
  if (notice.level === 0) return `${LABEL[kind]} due soon`;
  if (notice.level === 1) return `${LABEL[kind]} overdue`;
  return `${LABEL[kind]} overdue for a week and escalated to you`;
}

function recipientOf(item: WorkItemRow, notice: WorkNotice): string | null {
  if (notice.recipient === 'assignee') return item.assignee_id;
  // nobody escalates to themselves (an owner who leads the case, a self-assigned task)
  return item.escalation_id === item.assignee_id ? null : item.escalation_id;
}

function rowOf(
  kind: WorkItemKind,
  item: WorkItemRow,
  notice: WorkNotice,
  asOf: Date,
): Omit<NotificationRow, 'user_id'> {
  return {
    kind: notice.kind,
    dedupe_key: notice.dedupeKey,
    entity_type: kind,
    entity_id: item.id,
    detail: {
      reason: notice.level === 0 ? 'due' : 'overdue',
      level: notice.level,
      recipient: notice.recipient,
      title: item.title,
      message: messageOf(kind, notice),
      dueAt: new Date(item.due).toISOString(),
      ...(item.rca_id
        ? { rcaId: item.rca_id, caseTitle: item.case_title }
        : {}),
      remindedAt: asOf.toISOString(),
    },
  };
}

/**
 * Item 6 reminders of one kind of work in one plant at `asOf`: open items due between the lookback and the
 * lead time ahead owe the notices of `workItemNotices`; each goes to its person when that person is an
 * active member of the plant (`plantMembersOf`), otherwise nowhere.
 */
export async function workItemRows(
  manager: EntityManager,
  input: {
    tenantId: string;
    kind: WorkItemKind;
    asOf: Date;
    lookbackMs: number;
  },
  timings: WorkTimings,
): Promise<NotificationRow[]> {
  const { tenantId, kind, asOf } = input;
  const items: WorkItemRow[] = await manager.query(
    kind === 'rca_action' ? ACTIONS_SQL : TASKS_SQL,
    [
      tenantId,
      new Date(asOf.getTime() - input.lookbackMs),
      new Date(asOf.getTime() + timings.leadMs),
    ],
  );
  const owed = items.flatMap((item) =>
    workItemNotices(
      { kind, id: item.id, dueAt: new Date(item.due) },
      asOf,
      timings,
    )
      .map((notice) => ({ userId: recipientOf(item, notice), item, notice }))
      .filter((o): o is typeof o & { userId: string } => o.userId !== null),
  );
  const members = await plantMembersOf(
    manager,
    tenantId,
    owed.map((o) => o.userId),
  );
  return owed
    .filter((o) => members.has(o.userId))
    .map((o) => ({
      user_id: o.userId,
      ...rowOf(kind, o.item, o.notice, asOf),
    }));
}
