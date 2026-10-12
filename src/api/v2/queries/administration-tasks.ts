import type { CreateTaskInput, TaskSummaryView, TaskView, UpdateTaskInput } from '../types/administration';
import { adminCall, compactQuery, useAdminCommand, useAdminRead, useAdminRecord } from './administration-shared';
import { usePagedQuery } from './use-paged-query';

/** Server filters of `GET /v2/tasks` (the summary takes the same ones except status and overdue). */
export interface TaskFilters {
  q?: string;
  statuses?: readonly string[];
  priorities?: readonly string[];
  assignedToMe?: boolean;
  overdue?: boolean;
  linkType?: string;
  linkId?: string;
  sort?: 'dueDate' | '-createdAt';
}

/** The plant's tasks, 20 per page (keyset, earliest due first). */
export function useTasksPage(filters: TaskFilters) {
  const query = compactQuery({ ...filters, assignedToMe: filters.assignedToMe || undefined, overdue: filters.overdue || undefined });
  return usePagedQuery<TaskView>({ resource: 'tasks', path: '/tasks', query, key: { filters: query } });
}

/** Counts of the filtered tasks, computed on the server. */
export function useTaskSummary(filters: TaskFilters) {
  const { q, priorities, assignedToMe, linkType, linkId } = filters;
  const query = compactQuery({ q, priorities, assignedToMe: assignedToMe || undefined, linkType, linkId });
  return useAdminRead<TaskSummaryView>('tasks', '/tasks/summary', query);
}

export const useTask = (id: string | null | undefined) => useAdminRecord<TaskView>('tasks', id, `/tasks/${id ?? ''}`);

export function useCreateTask() {
  return useAdminCommand<CreateTaskInput, TaskView>('task', (body, idempotencyKey) => adminCall('POST', '/tasks', { body, idempotencyKey }));
}

export function useUpdateTask() {
  return useAdminCommand<{ id: string; body: UpdateTaskInput }, TaskView>('task', ({ id, body }) => adminCall('PATCH', `/tasks/${id}`, { body }));
}

export function useCompleteTask() {
  return useAdminCommand<string, TaskView>('task', (id, idempotencyKey) => adminCall('POST', `/tasks/${id}/complete`, { idempotencyKey }));
}

export function useDeleteTask() {
  return useAdminCommand<string, void>('task', (id) => adminCall('DELETE', `/tasks/${id}`));
}
