import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { AuditLog } from '../audit-log/audit-log.entity';
import { User } from '../users/user.entity';

export type SessionAuditAction = 'LOGIN' | 'LOGOUT';

const DETAILS: Record<SessionAuditAction, string> = {
  LOGIN: 'User logged in',
  LOGOUT: 'User logged out',
};

/**
 * Login and logout in the audit log, written by the server (the auto-audit interceptor skips them: the
 * login request has no user yet, logout is public). A failed audit write is logged, never fails the
 * sign-in itself.
 */
@Injectable()
export class SessionAuditService {
  private readonly logger = new Logger(SessionAuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly logs: Repository<AuditLog>,
  ) {}

  async record(
    user: Pick<User, 'id' | 'name' | 'email' | 'tenantId' | 'organizationId'>,
    action: SessionAuditAction,
  ): Promise<void> {
    try {
      await this.logs.insert({
        id: randomUUID(),
        userId: user.id,
        action,
        entityType: 'USER',
        entityId: user.id,
        details: JSON.stringify({
          userName: user.name || user.email,
          message: DETAILS[action],
        }),
        organizationId: user.organizationId || undefined,
        tenantId: user.tenantId || undefined,
        timestamp: new Date(),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Session audit (${action}) not written: ${message}`);
    }
  }
}
