import { taskApi, CreateTaskPayload, TaskDto } from '../api/taskApi';
import { auditService } from '../AuditService';
import type { RCARecommendation } from '../MasterDataService';

export function mapRecommendationStatus(status: string): string {
  if (status === 'Planned') return 'Open';
  if (['Open', 'In Progress', 'Completed', 'Cancelled'].includes(status)) return status;
  return 'Open';
}

export function buildTaskFromRecommendation(
  rec: RCARecommendation,
  rca: { id: string; title: string },
  ctx: {
    assignedBy: string;
    organizationId: string;
    tenantId: string;
  },
): CreateTaskPayload {
  return {
    title: rec.title,
    description: [
      rec.description,
      '',
      `---`,
      `Source: RCA "${rca.title}"`,
      `Recommendation ID: ${rec.id}`,
      rec.estimatedCost ? `Estimated cost: $${rec.estimatedCost}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    assignedTo: rec.assigneeId,
    assignedBy: ctx.assignedBy,
    priority: rec.priority,
    status: mapRecommendationStatus(rec.status),
    dueDate: rec.dueDate,
    entityType: 'RCARecommendation',
    entityId: rec.id,
    organizationId: ctx.organizationId,
    tenantId: ctx.tenantId,
  };
}

export function buildTaskFromRCA(
  rca: { id: string; title: string; description?: string },
  ctx: {
    assignedTo: string;
    assignedBy: string;
    organizationId: string;
    tenantId: string;
    title?: string;
    description?: string;
  },
): CreateTaskPayload {
  return {
    title: ctx.title || `RCA follow-up: ${rca.title}`,
    description:
      ctx.description ||
      [rca.description, '', `Linked RCA: ${rca.title}`, `RCA ID: ${rca.id}`].filter(Boolean).join('\n'),
    assignedTo: ctx.assignedTo,
    assignedBy: ctx.assignedBy,
    priority: 'Medium',
    status: 'Open',
    entityType: 'RCA',
    entityId: rca.id,
    organizationId: ctx.organizationId,
    tenantId: ctx.tenantId,
  };
}

export async function createTaskFromRecommendation(
  rec: RCARecommendation,
  rca: { id: string; title: string },
  ctx: {
    assignedBy: string;
    assignedByName: string;
    organizationId: string;
    tenantId: string;
  },
): Promise<TaskDto> {
  const payload = buildTaskFromRecommendation(rec, rca, ctx);
  const task = await taskApi.create(payload, { clientAudited: true });
  await auditService.logCreate(
    'Task',
    task.id,
    task.title,
    ctx.assignedBy,
    ctx.assignedByName,
    ctx.organizationId,
    ctx.tenantId,
  );
  return task;
}

export async function createTaskFromRCA(
  rca: { id: string; title: string; description?: string },
  ctx: {
    assignedTo: string;
    assignedBy: string;
    assignedByName: string;
    organizationId: string;
    tenantId: string;
    title?: string;
    description?: string;
  },
): Promise<TaskDto> {
  const payload = buildTaskFromRCA(rca, ctx);
  const task = await taskApi.create(payload, { clientAudited: true });
  await auditService.logCreate(
    'Task',
    task.id,
    task.title,
    ctx.assignedBy,
    ctx.assignedByName,
    ctx.organizationId,
    ctx.tenantId,
  );
  return task;
}

export async function loadLinkedTaskIds(rcaId: string, recommendationIds: string[]): Promise<{
  rcaTaskCount: number;
  recommendationTaskIds: Set<string>;
}> {
  const [rcaTasks, ...recTasks] = await Promise.all([
    taskApi.list({ entityType: 'RCA', entityId: rcaId }),
    ...recommendationIds.map((id) => taskApi.list({ entityType: 'RCARecommendation', entityId: id })),
  ]);

  const recommendationTaskIds = new Set<string>();
  recTasks.forEach((tasks, index) => {
    if (tasks.length > 0) recommendationTaskIds.add(recommendationIds[index]);
  });

  return { rcaTaskCount: rcaTasks.length, recommendationTaskIds };
}
