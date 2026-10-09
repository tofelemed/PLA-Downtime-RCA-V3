import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  getRequestContext,
  RequestContext,
} from '../../common/context/request-context';
import { RequestWithContext } from '../../common/context/request-context.middleware';
import { isPublicRoute } from '../../common/decorators/public.decorator';
import { READ_ONLY_ALLOWED_KEY } from '../decorators/read-only-allowed.decorator';
import { AccessDenialAuditService } from '../scopes/access-denial-audit.service';

const MUTATING_METHODS: ReadonlySet<string> = new Set([
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
]);
const READ_ONLY_ROLES: ReadonlySet<string> = new Set(['viewer']);

/**
 * Global guard (last in the chain): callers whose roles in the acting tenant are only read-only
 * roles (`viewer`, §13.2) cannot change data. Every POST / PUT / PATCH / DELETE answers 403
 * `READ_ONLY_ROLE` unless the handler is `@ReadOnlyAllowed()`; denials are audited.
 */
@Injectable()
export class WriteAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly denials: AccessDenialAuditService,
  ) {}

  canActivate(executionContext: ExecutionContext): boolean {
    if (executionContext.getType() !== 'http') return true;
    const request = executionContext
      .switchToHttp()
      .getRequest<RequestWithContext>();
    if (!MUTATING_METHODS.has(request.method)) return true;
    if (isPublicRoute(this.reflector, executionContext)) return true;
    const allowed = this.reflector.getAllAndOverride<boolean>(
      READ_ONLY_ALLOWED_KEY,
      [executionContext.getHandler(), executionContext.getClass()],
    );
    const context = request.requestContext ?? getRequestContext();
    if (allowed || !context?.userId || canWrite(context)) return true;
    this.denials.record(context, {
      reason: 'READ_ONLY_ROLE',
      entityType: 'Route',
      entityId: `${request.method} ${request.path}`,
      method: request.method,
      path: request.path,
    });
    throw new ForbiddenException({
      code: 'READ_ONLY_ROLE',
      message: 'Your role in this tenant is read-only',
    });
  }
}

/** A caller may write when it holds at least one role that is not read-only in the acting tenant. */
export function canWrite(context: RequestContext): boolean {
  return context.roles.some((role) => !READ_ONLY_ROLES.has(role));
}
