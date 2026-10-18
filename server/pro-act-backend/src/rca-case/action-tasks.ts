import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { RcaAction } from '../rca/entities/rca-action.entity';
import { childAudit, recordRcaAudit } from './rca-audit';

/** The task that carries out an action (item 5): the open one, else the latest. */
export interface RcaActionTaskV2View {
  id: string;
  /** `Open` | `In Progress` | `Completed` | `Cancelled` */
  status: string;
  assigneeId: string;
  dueDate: string | null;
  completedAt: string | null;
}

interface TaskRow {
  id: string;
  rca_action_id: string;
  status: string;
  assigned_to: string;
  due_date: Date | null;
  completed_date: Date | null;
}

const iso = (value: Date | null) => (value ? value.toISOString() : null);

/** Per action, its linked task (open first, then the most recently changed), in one query. */
export async function linkedTasks(
  manager: EntityManager,
  tenantId: string,
  actionIds: readonly string[],
): Promise<Map<string, RcaActionTaskV2View>> {
  if (actionIds.length === 0) return new Map();
  const rows: TaskRow[] = await manager.query(
    `SELECT DISTINCT ON (t."rca_action_id") t."id", t."rca_action_id", t."status", t."assigned_to",
            t."due_date", t."completed_date"
       FROM "tasks" t
      WHERE t."tenant_id" = $1 AND t."rca_action_id" = ANY($2::uuid[])
      ORDER BY t."rca_action_id", (t."status" IN ('Open', 'In Progress')) DESC, t."updated_at" DESC, t."id"`,
    [tenantId, actionIds],
  );
  return new Map(
    rows.map((row) => [
      row.rca_action_id,
      {
        id: row.id,
        status: row.status,
        assigneeId: row.assigned_to,
        dueDate: iso(row.due_date),
        completedAt: iso(row.completed_date),
      },
    ]),
  );
}

/** What a task names about its RCA link. */
export interface ActionTaskLink {
  tenantId: string;
  /** the case of the task's `RCA` link */
  rcaId: string | null;
  actionId: string;
  /** the task being changed (excluded from the duplicate check) */
  taskId?: string;
}

/**
 * A task linked to an action must be linked to that action's case (`linkType` RCA, 422 otherwise) and be
 * the only open task of the action (409 ACTION_TASK_EXISTS): the browser no longer dedupes by title.
 */
export async function assertActionTask(
  manager: EntityManager,
  link: ActionTaskLink,
): Promise<void> {
  const action = await manager
    .getRepository(RcaAction)
    .findOneBy({ id: link.actionId, tenantId: link.tenantId });
  if (!action || action.rcaId !== link.rcaId) {
    const message =
      'rcaActionId must be an action of the case named by linkType RCA / linkId';
    throw new UnprocessableEntityException({
      code: 'INVALID_REFERENCE',
      message: [message],
      fieldErrors: [{ field: 'rcaActionId', message }],
    });
  }
  const open: unknown[] = await manager.query(
    `SELECT 1 FROM "tasks" WHERE "tenant_id" = $1 AND "rca_action_id" = $2
        AND "status" IN ('Open', 'In Progress') AND "id" IS DISTINCT FROM $3::uuid LIMIT 1`,
    [link.tenantId, link.actionId, link.taskId ?? null],
  );
  if (open.length > 0) throw actionTaskExists();
}

export function actionTaskExists(): ConflictException {
  return new ConflictException({
    code: 'ACTION_TASK_EXISTS',
    message: 'this action already has an open task',
  });
}

/**
 * Status flow-back (item 5): a linked task completed sets the action's `taskCompletedAt`; reopened, it
 * clears it. The action's own status is never moved — it is completed with its evidence and an
 * independent verifier (CA4). Audited as `rca_action.task_completed` / `task_reopened`.
 */
export async function recordTaskOutcome(
  manager: EntityManager,
  input: {
    tenantId: string;
    actorId: string | null;
    actionId: string;
    completedAt: Date | null;
  },
): Promise<void> {
  const repository = manager.getRepository(RcaAction);
  const action = await repository
    .createQueryBuilder('a')
    .setLock('pessimistic_write')
    .where('a.id = :id AND a.tenantId = :tenantId', {
      id: input.actionId,
      tenantId: input.tenantId,
    })
    .getOne();
  if (!action) return;
  const before = { ...action };
  const saved = await repository.save({
    ...action,
    taskCompletedAt: input.completedAt,
  });
  await recordRcaAudit(
    manager,
    { tenantId: input.tenantId, userId: input.actorId, units: null },
    [
      childAudit(
        'rca_action',
        input.completedAt ? 'task_completed' : 'task_reopened',
        { before, after: saved },
      ),
    ],
  );
}
