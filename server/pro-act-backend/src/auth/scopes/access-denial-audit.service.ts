import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../audit-log/audit-log.entity';
import { RequestContext } from '../../common/context/request-context';

export interface AccessDenial {
  /** TENANT_NOT_ALLOWED, SCOPE_NOT_ALLOWED, ... */
  reason: string;
  /** Tenant, Unit, Site, ... */
  entityType: string;
  /** the id the caller tried to reach */
  entityId: string;
  method?: string;
  path?: string;
}

export const ACCESS_DENIED_ACTION = 'ACCESS_DENIED';

/**
 * Writes an `audit_logs` row for every cross-tenant or out-of-scope attempt (T14: "audit row
 * written"). Fire-and-forget: a failing audit write is logged, never surfaced to the caller.
 */
@Injectable()
export class AccessDenialAuditService {
  private readonly logger = new Logger(AccessDenialAuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogs: Repository<AuditLog>,
  ) {}

  record(context: RequestContext, denial: AccessDenial): void {
    if (!context.userId) {
      return;
    }
    const row = this.auditLogs.create({
      userId: context.userId,
      action: ACCESS_DENIED_ACTION,
      entityType: denial.entityType,
      entityId: denial.entityId.slice(0, 36),
      tenantId: context.tenantId ?? undefined,
      organizationId: context.organizationId ?? undefined,
      details: JSON.stringify({
        reason: denial.reason,
        method: denial.method,
        path: denial.path,
        correlationId: context.correlationId,
      }),
      timestamp: new Date(),
    });
    void this.auditLogs.insert(row).catch((error: unknown) => {
      this.logger.warn(
        `Could not record access denial ${denial.reason} for user ${context.userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }
}
