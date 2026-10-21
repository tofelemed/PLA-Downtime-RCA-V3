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
import { CLIENT_AUDITED_KEY } from './client-audited.decorator';
import {
  isPreviewBody,
  SKIP_AUDIT_PREVIEW_KEY,
} from './skip-audit-preview.decorator';
import {
  auditRecordLabel,
  auditResponseId,
  methodToAuditAction,
  resolveAuditTarget,
  shouldSkipAudit,
} from './audit-auto-log.config';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    if (shouldSkipAudit(path, method) || this.isDryRun(context, request.body)) {
      return next.handle();
    }

    if (
      request.headers?.['x-client-audited'] === 'true' &&
      this.allowsClientAudit(context)
    ) {
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

  /** `X-Client-Audited` counts only on `@ClientAudited()` routes; elsewhere the server always audits. */
  private allowsClientAudit(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(CLIENT_AUDITED_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }

  /** `@SkipAuditOnPreview()` routes called with `preview: true`: a dry run changes nothing. */
  private isDryRun(context: ExecutionContext, body: unknown): boolean {
    const marked = this.reflector.getAllAndOverride<boolean>(
      SKIP_AUDIT_PREVIEW_KEY,
      [context.getHandler(), context.getClass()],
    );
    return marked === true && isPreviewBody(body);
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
      responseId: auditResponseId(body),
      requestId: typeof reqBody.id === 'string' ? reqBody.id : undefined,
    });
    const subresourceNote = subresource
      ? ` [${subresource.kind}${subresource.id ? ` ${subresource.id}` : ''}]`
      : '';

    // a change to a plant's own record (`PUT|PATCH /tenants/:id`) belongs to that plant, not to the plant the
    // caller acts in; a create or delete stays with the caller's plant (the row must outlive a deleted plant)
    const routeId = request.params?.id;
    const ownPlant =
      entityType === 'Tenant' &&
      (method === 'PUT' || method === 'PATCH') &&
      typeof routeId === 'string' &&
      UUID.test(routeId)
        ? routeId
        : undefined;
    const tenantId =
      ownPlant ||
      (typeof body.tenantId === 'string' && body.tenantId) ||
      (typeof reqBody.tenantId === 'string' && reqBody.tenantId) ||
      user.tenantId ||
      undefined;

    const organizationId =
      (typeof body.organizationId === 'string' && body.organizationId) ||
      (typeof reqBody.organizationId === 'string' && reqBody.organizationId) ||
      user.organizationId ||
      '';

    const label = auditRecordLabel(body, reqBody) ?? entityId;

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
