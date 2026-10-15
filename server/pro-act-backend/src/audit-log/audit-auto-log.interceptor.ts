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
import { AUDIT_READ_KEY } from './audit-read.decorator';
import {
  methodToAuditAction,
  resolveAuditTarget,
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
    const readEntity = this.reflector.get<string | undefined>(
      AUDIT_READ_KEY,
      context.getHandler(),
    );

    if (readEntity && method === 'GET') {
      return this.auditRead(next, request, path, readEntity);
    }
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
        void this.record(request, method, path, responseBody, user).catch(
          (err: unknown) => {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(
              `Auto-audit failed for ${method} ${path}: ${message}`,
            );
          },
        );
      }),
    );
  }

  /** `@AuditRead()`: who read which raw / sensitive record, after a successful response. */
  private auditRead(
    next: CallHandler,
    request: { params?: Record<string, string>; user?: JwtUser },
    path: string,
    entityType: string,
  ): Observable<unknown> {
    const user = request.user;
    if (!user?.userId) return next.handle();
    return next.handle().pipe(
      tap(() => {
        void this.auditLogService
          .create({
            userId: user.userId,
            userName: user.email || user.userId,
            action: 'READ',
            entityType,
            entityId: request.params?.id || 'unknown',
            details: `READ ${entityType} via API GET ${path.split('?')[0]}`,
            organizationId: user.organizationId || '',
            tenantId: user.tenantId || undefined,
            timestamp: new Date(),
          })
          .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Read audit failed for ${path}: ${message}`);
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
    const body = (
      responseBody && typeof responseBody === 'object' ? responseBody : {}
    ) as Record<string, unknown>;
    const reqBody = request.body || {};

    // Sub-resource writes are attributed to the parent record (see resolveAuditTarget)
    const { entityType, entityId, subresource } = resolveAuditTarget({
      path,
      params: request.params,
      responseId: typeof body.id === 'string' ? body.id : undefined,
      requestId: typeof reqBody.id === 'string' ? reqBody.id : undefined,
    });
    const subresourceNote = subresource
      ? ` [${subresource.kind}${subresource.id ? ` ${subresource.id}` : ''}]`
      : '';

    const tenantId =
      (typeof body.tenantId === 'string' && body.tenantId) ||
      (typeof reqBody.tenantId === 'string' && reqBody.tenantId) ||
      user.tenantId ||
      undefined;

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
      details: `${action} ${entityType} "${label}" via API ${method} ${path}${subresourceNote}`,
      organizationId,
      tenantId,
      timestamp: new Date(),
    });
  }
}
