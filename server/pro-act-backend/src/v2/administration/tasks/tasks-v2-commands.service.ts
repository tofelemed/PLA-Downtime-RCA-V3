import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
  RequestContext,
  requireTenantId,
} from '../../../common/context/request-context';
import { RealtimeGateway } from '../../../realtime.gateway';
import {
  actionTaskExists,
  assertActionTask,
  recordTaskOutcome,
} from '../../../rca-case/action-tasks';
import { Task } from '../../../task/task.entity';
import { PlaceNamesService } from '../common/place-names.service';
import { UserDirectoryService } from '../users/user-directory.service';
import { CreateTaskV2Dto, UpdateTaskV2Dto } from './tasks-v2.dto';
import { TaskV2View } from './task-v2.view';
import { TasksV2Service } from './tasks-v2.service';

type TaskPatch = QueryDeepPartialEntity<Task>;

/** Clears a nullable column in an update (the entity types the column as optional, not nullable). */
const SQL_NULL = (): string => 'NULL';

/** Status → completion time: set when a task becomes Completed, cleared when it leaves Completed. */
function completionPatch(current: Task, status: string | undefined): TaskPatch {
  if (!status || status === current.status) return {};
  return {
    status,
    completedDate: status === 'Completed' ? new Date() : SQL_NULL,
  };
}

function linkPatch(body: UpdateTaskV2Dto): TaskPatch {
  if (body.linkType === null)
    return { entityType: SQL_NULL, entityId: SQL_NULL, rcaActionId: SQL_NULL };
  const patch: TaskPatch = {};
  if (body.linkType !== undefined) patch.entityType = body.linkType;
  if (body.linkId !== undefined) patch.entityId = body.linkId ?? SQL_NULL;
  if (body.rcaActionId !== undefined)
    patch.rcaActionId = body.rcaActionId ?? SQL_NULL;
  else if (body.linkType !== undefined && body.linkType !== 'RCA')
    patch.rcaActionId = SQL_NULL;
  return patch;
}

/** The unique index of one open task per action refused the write (a concurrent duplicate). */
function isOpenTaskDuplicate(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { constraint?: string } | undefined)?.constraint ===
      'UQ_tasks_open_rca_action'
  );
}

function fieldPatch(body: UpdateTaskV2Dto): TaskPatch {
  const patch: TaskPatch = {};
  if (body.title !== undefined) patch.title = body.title.trim();
  if (body.description !== undefined)
    patch.description = body.description ?? SQL_NULL;
  if (body.priority !== undefined) patch.priority = body.priority;
  if (body.assigneeId !== undefined) patch.assignedTo = body.assigneeId;
  if (body.dueDate !== undefined) {
    patch.dueDate = body.dueDate === null ? SQL_NULL : new Date(body.dueDate);
  }
  return patch;
}

/**
 * Task writes of the acting plant: the assigner is the caller, the plant and organization come from the
 * identity, the assignee must be an active member of the plant (422 INVALID_ASSIGNEE). Changes are
 * broadcast like v1 (`task` entity events) and audited by the global audit interceptor.
 */
@Injectable()
export class TasksV2CommandsService {
  constructor(
    @InjectRepository(Task) private readonly tasks: Repository<Task>,
    private readonly reads: TasksV2Service,
    private readonly directory: UserDirectoryService,
    private readonly places: PlaceNamesService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async create(
    context: RequestContext,
    body: CreateTaskV2Dto,
  ): Promise<TaskV2View> {
    const tenantId = requireTenantId(context);
    await this.assertAssignee(tenantId, body.assigneeId);
    if (body.rcaActionId) {
      await assertActionTask(this.tasks.manager, {
        tenantId,
        rcaId: body.linkType === 'RCA' ? (body.linkId ?? null) : null,
        actionId: body.rcaActionId,
      });
    }
    const status = body.status ?? 'Open';
    const organizationId = await this.places.organizationOf(tenantId);
    const saved = await this.insert(
      this.tasks.create({
        id: randomUUID(),
        title: body.title.trim(),
        description: body.description,
        assignedTo: body.assigneeId,
        assignedBy: context.userId ?? '',
        priority: body.priority,
        status,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        completedDate: status === 'Completed' ? new Date() : undefined,
        entityType: body.linkType,
        entityId: body.linkType ? body.linkId : undefined,
        rcaActionId: body.rcaActionId ?? null,
        organizationId: organizationId ?? context.organizationId ?? '',
        tenantId,
      }),
    );
    if (saved.rcaActionId && status === 'Completed') {
      await recordTaskOutcome(this.tasks.manager, {
        tenantId,
        actorId: context.userId ?? null,
        actionId: saved.rcaActionId,
        completedAt: saved.completedDate ?? new Date(),
      });
    }
    this.realtime.broadcastEntityEvent('Created', 'task', saved);
    return this.reads.get(context, saved.id);
  }

  async update(
    context: RequestContext,
    id: string,
    body: UpdateTaskV2Dto,
  ): Promise<TaskV2View> {
    const current = await this.reads.find(context, id);
    if (body.assigneeId && body.assigneeId !== current.assignedTo) {
      await this.assertAssignee(requireTenantId(context), body.assigneeId);
    }
    const patch = {
      ...fieldPatch(body),
      ...linkPatch(body),
      ...completionPatch(current, body.status),
    };
    if (body.rcaActionId) {
      const linkType =
        body.linkType === undefined ? current.entityType : body.linkType;
      const linkId = body.linkId === undefined ? current.entityId : body.linkId;
      await assertActionTask(this.tasks.manager, {
        tenantId: current.tenantId,
        rcaId: linkType === 'RCA' ? (linkId ?? null) : null,
        actionId: body.rcaActionId,
        taskId: current.id,
      });
    }
    return this.apply(context, current, patch);
  }

  /** Marks the task completed (nothing changes when it already is). */
  async complete(context: RequestContext, id: string): Promise<TaskV2View> {
    const current = await this.reads.find(context, id);
    return this.apply(context, current, completionPatch(current, 'Completed'));
  }

  async remove(context: RequestContext, id: string): Promise<void> {
    const current = await this.reads.find(context, id);
    await this.tasks.delete({ id: current.id, tenantId: current.tenantId });
    this.realtime.broadcastEntityEvent('Deleted', 'task', { id: current.id });
  }

  private async apply(
    context: RequestContext,
    current: Task,
    patch: TaskPatch,
  ): Promise<TaskV2View> {
    if (Object.keys(patch).length > 0) {
      await this.write(() =>
        this.tasks.manager.transaction(async (manager) => {
          await manager
            .getRepository(Task)
            .update({ id: current.id, tenantId: current.tenantId }, patch);
          await this.flowBack(manager, context, current);
        }),
      );
      const updated = await this.reads.find(context, current.id);
      this.realtime.broadcastEntityEvent('Updated', 'task', updated);
    }
    return this.reads.get(context, current.id);
  }

  private insert(task: Task): Promise<Task> {
    return this.write(() => this.tasks.save(task));
  }

  /** 409 ACTION_TASK_EXISTS when the one-open-task-per-action index refuses a concurrent write. */
  private async write<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (isOpenTaskDuplicate(error)) throw actionTaskExists();
      throw error;
    }
  }

  /**
   * Item 5 flow-back: when the task of an RCA action becomes Completed (or leaves Completed) the action
   * records it (`taskCompletedAt`); the action's own status never moves (CA4 evidence still decides).
   */
  private async flowBack(
    manager: EntityManager,
    context: RequestContext,
    before: Task,
  ): Promise<void> {
    const after = await manager
      .getRepository(Task)
      .findOneBy({ id: before.id, tenantId: before.tenantId });
    const actionId = after?.rcaActionId ?? before.rcaActionId;
    if (!after || !actionId) return;
    const wasDone = before.status === 'Completed';
    const isDone = after.status === 'Completed' && Boolean(after.rcaActionId);
    if (wasDone === isDone && before.rcaActionId === after.rcaActionId) return;
    await recordTaskOutcome(manager, {
      tenantId: after.tenantId,
      actorId: context.userId ?? null,
      actionId,
      completedAt: isDone ? (after.completedDate ?? new Date()) : null,
    });
  }

  private async assertAssignee(
    tenantId: string,
    userId: string,
  ): Promise<void> {
    if (await this.directory.isActiveMember(tenantId, userId)) return;
    throw new UnprocessableEntityException({
      code: 'INVALID_ASSIGNEE',
      message: 'The assignee must be an active member of this plant',
    });
  }
}
