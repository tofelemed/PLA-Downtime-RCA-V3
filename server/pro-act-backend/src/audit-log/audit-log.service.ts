import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { AuditLog } from './audit-log.entity';
import { RealtimeGateway } from '../realtime.gateway';
import {
  RequestContext,
  tenantRequired,
} from '../common/context/request-context';
import { tenantMismatch } from '../auth/guards/tenant-binding.guard';

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

/** Rows per `GET /api/audit-logs` page: the default, and also the most one request may read. */
export const AUDIT_LIST_MAX = 500;

/**
 * The page size of a v1 audit-log list request (perf audit P07 / DB audit F10): an integer 1–500; anything
 * missing, zero, negative or not a number means the default 500, larger values are capped at 500, so one
 * request never reads the whole table (`limit=0` used to mean "no limit").
 */
export function auditListLimit(raw?: string): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return AUDIT_LIST_MAX;
  return Math.min(parsed, AUDIT_LIST_MAX);
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  /**
   * The tenant whose audit trail the caller may read: the acting tenant (`X-Tenant-Id` or the token
   * tenant), never one named in the query. A `tenantId` filter must name the acting tenant (403
   * TENANT_MISMATCH otherwise); a SuperAdmin reads another tenant by selecting it with `X-Tenant-Id`.
   */
  readableTenant(context: RequestContext, requested?: string): string {
    if (!context.tenantId) throw tenantRequired();
    if (requested && requested !== context.tenantId) throw tenantMismatch();
    return context.tenantId;
  }

  findWithFilters(filters: AuditLogQuery): Promise<AuditLog[]> {
    const qb = this.auditLogRepository.createQueryBuilder('log');

    if (filters.tenantId) {
      qb.andWhere('log.tenantId = :tenantId', { tenantId: filters.tenantId });
    }
    if (filters.userId) {
      qb.andWhere('log.userId = :userId', { userId: filters.userId });
    }
    if (filters.entityType) {
      qb.andWhere('log.entityType = :entityType', {
        entityType: filters.entityType,
      });
    }
    if (filters.entityId) {
      qb.andWhere('log.entityId = :entityId', { entityId: filters.entityId });
    }
    if (filters.action) {
      qb.andWhere('log.action = :action', { action: filters.action });
    }
    if (filters.startDate && filters.endDate) {
      qb.andWhere('log.createdAt >= :startDate AND log.createdAt <= :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    } else if (filters.startDate) {
      qb.andWhere('log.createdAt >= :startDate', {
        startDate: filters.startDate,
      });
    } else if (filters.endDate) {
      qb.andWhere('log.createdAt <= :endDate', { endDate: filters.endDate });
    }

    qb.orderBy('log.createdAt', 'DESC');
    if (filters.limit) qb.take(filters.limit);
    if (filters.offset) qb.skip(filters.offset);

    return qb.getMany();
  }

  findOne(id: string): Promise<AuditLog | null> {
    return this.auditLogRepository.findOneBy({ id });
  }

  /** One entry of `tenantId`'s trail; an entry of another tenant reads as absent (null). */
  findOneInTenant(id: string, tenantId: string): Promise<AuditLog | null> {
    return this.auditLogRepository.findOneBy({ id, tenantId });
  }

  async create(
    data: Partial<AuditLog> & {
      userName?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<AuditLog> {
    const { userName, ipAddress, userAgent, ...rest } = data;
    let details = rest.details;
    if (userName || ipAddress || userAgent) {
      const payload: Record<string, unknown> = {
        userName: userName || undefined,
        message: typeof details === 'string' ? details : details,
        ipAddress: ipAddress || undefined,
        userAgent: userAgent || undefined,
      };
      details = JSON.stringify(payload);
    }

    const log = this.auditLogRepository.create({
      id: randomUUID(),
      ...rest,
      details:
        typeof details === 'string' ? details : JSON.stringify(details ?? {}),
      timestamp: rest.timestamp ? new Date(rest.timestamp) : new Date(),
    });
    // a plain INSERT: `save()` with a preset id first SELECTs the row, then inserts inside a transaction
    // (perf audit P12); generated columns are returned into `log` either way
    await this.auditLogRepository.insert(log);
    this.realtimeGateway.broadcastEntityEvent('Created', 'auditLog', log);
    return log;
  }

  async update(id: string, data: Partial<AuditLog>): Promise<AuditLog | null> {
    await this.auditLogRepository.update(id, data);
    const updated = await this.findOne(id);
    if (updated) {
      this.realtimeGateway.broadcastEntityEvent('Updated', 'auditLog', updated);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const log = await this.findOne(id);
    await this.auditLogRepository.delete(id);
    if (log) {
      this.realtimeGateway.broadcastEntityEvent('Deleted', 'auditLog', { id });
    }
  }
}
