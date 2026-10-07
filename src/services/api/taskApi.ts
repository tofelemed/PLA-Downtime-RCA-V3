import { httpClient } from './httpClient';

export interface TaskDto {
  id: string;
  title: string;
  description?: string;
  assignedTo: string;
  assignedBy: string;
  priority: string;
  status: string;
  dueDate?: string;
  completedDate?: string;
  entityType?: string;
  entityId?: string;
  organizationId: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  assignedTo: string;
  assignedBy: string;
  priority: string;
  status: string;
  dueDate?: string;
  completedDate?: string;
  entityType?: string;
  entityId?: string;
  organizationId: string;
  tenantId: string;
}

export interface TaskQuery {
  assignedTo?: string;
  status?: string;
  priority?: string;
  tenantId?: string;
  entityType?: string;
  entityId?: string;
  overdue?: boolean;
}

export const TASK_STATUSES = ['Open', 'In Progress', 'Completed', 'Cancelled'] as const;
export const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export const TASK_ENTITY_TYPES = ['General', 'RCA', 'RCARecommendation', 'ProductionEvent', 'ProductionPlan'] as const;

function buildParams(query: TaskQuery): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.assignedTo) params.assignedTo = query.assignedTo;
  if (query.status) params.status = query.status;
  if (query.priority) params.priority = query.priority;
  if (query.tenantId) params.tenantId = query.tenantId;
  if (query.entityType) params.entityType = query.entityType;
  if (query.entityId) params.entityId = query.entityId;
  if (query.overdue) params.overdue = 'true';
  return params;
}

const CLIENT_AUDITED_HEADER = { 'X-Client-Audited': 'true' };

class TaskApi {
  private basePath = '/tasks';

  async list(query?: TaskQuery): Promise<TaskDto[]> {
    const response = await httpClient.get<TaskDto[]>(this.basePath, {
      params: query ? buildParams(query) : undefined,
    });
    return response.data;
  }

  async get(id: string): Promise<TaskDto> {
    const response = await httpClient.get<TaskDto>(`${this.basePath}/${id}`);
    return response.data;
  }

  async create(payload: CreateTaskPayload, options?: { clientAudited?: boolean }): Promise<TaskDto> {
    const response = await httpClient.post<TaskDto>(this.basePath, payload, {
      headers: options?.clientAudited ? CLIENT_AUDITED_HEADER : undefined,
    });
    return response.data;
  }

  async update(
    id: string,
    payload: Partial<CreateTaskPayload>,
    options?: { clientAudited?: boolean },
  ): Promise<TaskDto> {
    const response = await httpClient.put<TaskDto>(`${this.basePath}/${id}`, payload, {
      headers: options?.clientAudited ? CLIENT_AUDITED_HEADER : undefined,
    });
    return response.data;
  }

  async delete(id: string, options?: { clientAudited?: boolean }): Promise<void> {
    await httpClient.delete(`${this.basePath}/${id}`, {
      headers: options?.clientAudited ? CLIENT_AUDITED_HEADER : undefined,
    });
  }
}

export const taskApi = new TaskApi();
