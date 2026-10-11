import { AuditLog } from './MasterDataService';
import { auditApi } from './api/auditApi';

export interface AuditAction {
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  userId: string;
  userName: string;
  organizationId: string;
  tenantId: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  private static instance: AuditService;

  private constructor() {}

  static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  async logAction(auditAction: AuditAction): Promise<AuditLog> {
    try {
      const result = await auditApi.createLog({
        userId: auditAction.userId,
        userName: auditAction.userName,
        action: auditAction.action,
        entityType: auditAction.entityType,
        entityId: auditAction.entityId,
        details: auditAction.details,
        organizationId: auditAction.organizationId,
        tenantId: auditAction.tenantId,
        ipAddress: auditAction.ipAddress,
        userAgent: auditAction.userAgent,
        timestamp: new Date().toISOString(),
      });
      
      // Map API response to AuditLog format
      return {
        id: result.id || crypto.randomUUID(),
        userId: auditAction.userId,
        userName: auditAction.userName,
        action: auditAction.action,
        entityType: auditAction.entityType,
        entityId: auditAction.entityId,
        details: typeof result.details === 'string' 
          ? JSON.parse(result.details || '{}') 
          : result.details,
        timestamp: result.timestamp || new Date().toISOString(),
        tenantId: auditAction.tenantId,
        organizationId: auditAction.organizationId,
        createdAt: result.createdAt || new Date().toISOString(),
        updatedAt: result.updatedAt || new Date().toISOString(),
      } as AuditLog;
    } catch (error) {
      console.error('Failed to log audit action to backend:', error);
      throw error;
    }
  }

  async getAuditLogs(filters?: {
    tenantId?: string;
    userId?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]> {
    try {
      const records = await auditApi.getAuditLogs(filters);
      return records.map((log) => {
        let details: unknown = log.details;
        try {
          details = log.details ? JSON.parse(log.details) : {};
        } catch {
          details = log.details;
        }
        const parsed = typeof details === 'object' && details !== null ? details as Record<string, unknown> : {};
        return {
          id: log.id,
          userId: log.userId,
          userName: (parsed.userName as string) || log.userId,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          details: parsed.message ?? log.details ?? '',
          timestamp: log.timestamp || log.createdAt,
          tenantId: log.tenantId || '',
          organizationId: log.organizationId || '',
          createdAt: log.createdAt,
          updatedAt: log.updatedAt,
        } as AuditLog;
      });
    } catch (error) {
      console.error('Failed to get audit logs from backend:', error);
      return [];
    }
  }

  async getAuditLogsByEntity(entityType: string, entityId: string, tenantId?: string): Promise<AuditLog[]> {
    const filters: any = { entityType, entityId };
    if (tenantId) {
      filters.tenantId = tenantId;
    }
    return await this.getAuditLogs(filters);
  }

  async getAuditLogsByUser(userId: string, tenantId?: string): Promise<AuditLog[]> {
    const filters: any = { userId };
    if (tenantId) {
      filters.tenantId = tenantId;
    }
    return await this.getAuditLogs(filters);
  }

  async getRecentActivity(tenantId: string, limit: number = 50): Promise<AuditLog[]> {
    return await this.getAuditLogs({ tenantId, limit });
  }

  // Convenience methods for common actions
  async logCreate(entityType: string, entityId: string, entityName: string, userId: string, userName: string, organizationId: string, tenantId: string): Promise<AuditLog> {
    return await this.logAction({
      action: 'CREATE',
      entityType,
      entityId,
      details: `Created ${entityType.toLowerCase()} "${entityName}"`,
      userId,
      userName,
      organizationId,
      tenantId,
    });
  }

  async logUpdate(entityType: string, entityId: string, entityName: string, userId: string, userName: string, organizationId: string, tenantId: string, changes?: string): Promise<AuditLog> {
    const details = changes 
      ? `Updated ${entityType.toLowerCase()} "${entityName}" - ${changes}`
      : `Updated ${entityType.toLowerCase()} "${entityName}"`;
    
    return await this.logAction({
      action: 'UPDATE',
      entityType,
      entityId,
      details,
      userId,
      userName,
      organizationId,
      tenantId,
    });
  }

  async logDelete(entityType: string, entityId: string, entityName: string, userId: string, userName: string, organizationId: string, tenantId: string): Promise<AuditLog> {
    return await this.logAction({
      action: 'DELETE',
      entityType,
      entityId,
      details: `Deleted ${entityType.toLowerCase()} "${entityName}"`,
      userId,
      userName,
      organizationId,
      tenantId,
    });
  }

  async logLogin(userId: string, userName: string, organizationId: string, tenantId: string, ipAddress?: string): Promise<AuditLog> {
    return await this.logAction({
      action: 'LOGIN',
      entityType: 'USER',
      entityId: userId,
      details: `User logged in`,
      userId,
      userName,
      organizationId,
      tenantId,
      ipAddress,
    });
  }

  async logLogout(userId: string, userName: string, organizationId: string, tenantId: string): Promise<AuditLog> {
    return await this.logAction({
      action: 'LOGOUT',
      entityType: 'USER',
      entityId: userId,
      details: `User logged out`,
      userId,
      userName,
      organizationId,
      tenantId,
    });
  }

  async logAccess(entityType: string, entityId: string, entityName: string, userId: string, userName: string, organizationId: string, tenantId: string): Promise<AuditLog> {
    return await this.logAction({
      action: 'ACCESS',
      entityType,
      entityId,
      details: `Accessed ${entityType.toLowerCase()} "${entityName}"`,
      userId,
      userName,
      organizationId,
      tenantId,
    });
  }

  async logExport(entityType: string, userId: string, userName: string, organizationId: string, tenantId: string, format: string): Promise<AuditLog> {
    return await this.logAction({
      action: 'EXPORT',
      entityType,
      entityId: 'N/A',
      details: `Exported ${entityType.toLowerCase()} data in ${format} format`,
      userId,
      userName,
      organizationId,
      tenantId,
    });
  }

  async logImport(entityType: string, userId: string, userName: string, organizationId: string, tenantId: string, recordCount: number): Promise<AuditLog> {
    return await this.logAction({
      action: 'IMPORT',
      entityType,
      entityId: 'N/A',
      details: `Imported ${recordCount} ${entityType.toLowerCase()} records`,
      userId,
      userName,
      organizationId,
      tenantId,
    });
  }

  // Get audit statistics
  async getAuditStats(tenantId: string, startDate?: string, endDate?: string): Promise<{
    totalActions: number;
    actionsByType: Record<string, number>;
    actionsByUser: Record<string, number>;
    recentActivity: AuditLog[];
  }> {
    const logs = await this.getAuditLogs({ tenantId, startDate, endDate });
    
    const actionsByType: Record<string, number> = {};
    const actionsByUser: Record<string, number> = {};
    
    logs.forEach(log => {
      actionsByType[log.action] = (actionsByType[log.action] || 0) + 1;
      actionsByUser[log.userName] = (actionsByUser[log.userName] || 0) + 1;
    });

    return {
      totalActions: logs.length,
      actionsByType,
      actionsByUser,
      recentActivity: logs.slice(0, 10), // Last 10 activities
    };
  }
}

// Export singleton instance
export const auditService = AuditService.getInstance(); 