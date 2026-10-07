import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditLogService } from './audit-log.service';
import { SKIP_AUDIT_KEY } from './skip-audit.decorator';
import {
  methodToAuditAction,
  resolveEntityType,
  shouldSkipAudit,
} from './audit-auto-log.config';

interface JwtUser {
  userId: string;
  email?: string;
  role?: string;
  tenantId?: string;
  organizationId?: string;
}

@Injectable()
export class AuditAutoLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditAutoLogInterceptor.name);

  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<{
      method: string;
      originalUrl?: string;
      url?: string;
      path?: string;
      params?: Record<string, string>;
      body?: Record<string, unknown>;
      user?: JwtUser;
      headers?: Record<string, string>;
    }>();

    const method = request.method || 'GET';
    const path = request.originalUrl || request.url || request.path || '';

    if (shouldSkipAudit(path, method)) {
      return next.handle();
    }

    if (request.headers?.['x-client-audited'] === 'true') {
      return next.handle();
    }

    const user = request.user;
    if (!user?.userId) {
      return next.handle();
    }

    return next.handle().pipe(
      tap((responseBody) => {
        void this.record(request, method, path, responseBody, user).catch((err) => {
          this.logger.warn(`Auto-audit failed for ${method} ${path}: ${err?.message || err}`);
        });
      }),
    );
  }

  private async record(
    request: {
      params?: Record<string, string>;
      body?: Record<string, unknown>;
    },
    method: string,
    path: string,
    responseBody: unknown,
    user: JwtUser,
  ): Promise<void> {
    const action = methodToAuditAction(method);
    const entityType = resolveEntityType(path);
    const body = (responseBody && typeof responseBody === 'object' ? responseBody : {}) as Record<
      string,
      unknown
    >;
    const reqBody = request.body || {};

    const entityId =
      (typeof body.id === 'string' && body.id) ||
      request.params?.id ||
      (typeof reqBody.id === 'string' && reqBody.id) ||
      'unknown';

    const tenantId =
      (typeof body.tenantId === 'string' && body.tenantId) ||
      (typeof reqBody.tenantId === 'string' && reqBody.tenantId) ||
      user.tenantId ||
      '';

    const organizationId =
      (typeof body.organizationId === 'string' && body.organizationId) ||
      (typeof reqBody.organizationId === 'string' && reqBody.organizationId) ||
      user.organizationId ||
      '';

    const label =
      (typeof body.title === 'string' && body.title) ||
      (typeof body.name === 'string' && body.name) ||
      (typeof reqBody.title === 'string' && reqBody.title) ||
      (typeof reqBody.name === 'string' && reqBody.name) ||
      entityId;

    await this.auditLogService.create({
      userId: user.userId,
      userName: user.email || user.userId,
      action,
      entityType,
      entityId,
      details: `${action} ${entityType} "${label}" via API ${method} ${path}`,
      organizationId,
      tenantId,
      timestamp: new Date(),
    });
  }
}
