import { httpClient } from './httpClient';

export interface CreateAuditLogRequest {
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown> | string;
  organizationId?: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: string;
}

export interface AuditLogRecord {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: string;
  organizationId?: string;
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
  timestamp: string;
}

export interface AuditLogQuery {
  tenantId?: string;
  userId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

function buildParams(query: AuditLogQuery): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.tenantId) params.tenantId = query.tenantId;
  if (query.userId) params.userId = query.userId;
  if (query.entityType) params.entityType = query.entityType;
  if (query.entityId) params.entityId = query.entityId;
  if (query.action) params.action = query.action;
  if (query.startDate) params.startDate = query.startDate;
  if (query.endDate) params.endDate = query.endDate;
  if (query.limit) params.limit = String(query.limit);
  if (query.offset) params.offset = String(query.offset);
  return params;
}

export function parseAuditDetails(details?: string): { userName?: string; message?: string; ipAddress?: string } {
  if (!details) return {};
  try {
    const parsed = JSON.parse(details);
    if (parsed && typeof parsed === 'object') {
      return {
        userName: parsed.userName,
        message: typeof parsed.message === 'string' ? parsed.message : JSON.stringify(parsed.message),
        ipAddress: parsed.ipAddress,
      };
    }
  } catch {
    // plain text details
  }
  return { message: details };
}

export const auditApi = {
  async createLog(payload: CreateAuditLogRequest) {
    const { details, organizationId, tenantId, ...rest } = payload;
    const body = {
      ...rest,
      organizationId: organizationId ?? '',
      tenantId: tenantId ?? '',
      details: typeof details === 'string' ? details : JSON.stringify(details),
    };
    return httpClient.request<AuditLogRecord>('audit-logs', { method: 'POST', body });
  },

  async getAuditLogs(query?: AuditLogQuery): Promise<AuditLogRecord[]> {
    const response = await httpClient.get<AuditLogRecord[]>('/audit-logs', {
      params: query ? buildParams(query) : undefined,
    });
    return response.data;
  },

  async getAuditLog(id: string): Promise<AuditLogRecord> {
    const response = await httpClient.get<AuditLogRecord>(`/audit-logs/${id}`);
    return response.data;
  },
};
