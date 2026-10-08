import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getRequestContext } from '../../common/context/request-context';
import { RequestWithContext } from '../../common/context/request-context.middleware';
import { isPublicRoute } from '../../common/decorators/public.decorator';
import {
  SCOPE_PARAM_KEY,
  ScopeParamSpec,
} from '../decorators/scope-param.decorator';
import { AccessDenialAuditService } from '../scopes/access-denial-audit.service';
import { ScopeMembershipService } from '../scopes/scope-membership.service';

/**
 * Global guard: enforces `@ScopeParam()` — the referenced tenant/site/unit id must be within the
 * caller's scopes (SuperAdmin bypasses). A foreign id gets a 404 so tenants cannot probe for the
 * existence of each other's records; the attempt is audited.
 */
@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly membership: ScopeMembershipService,
    private readonly denials: AccessDenialAuditService,
  ) {}

  async canActivate(executionContext: ExecutionContext): Promise<boolean> {
    const spec = this.reflector.getAllAndOverride<ScopeParamSpec | undefined>(
      SCOPE_PARAM_KEY,
      [executionContext.getHandler(), executionContext.getClass()],
    );
    if (!spec || isPublicRoute(this.reflector, executionContext)) {
      return true;
    }
    const request = executionContext
      .switchToHttp()
      .getRequest<RequestWithContext>();
    const context = request.requestContext ?? getRequestContext();
    if (!context?.userId) {
      return true; // JwtAuthGuard already rejected anonymous callers on protected routes
    }
    for (const id of readIds(request, spec)) {
      if (!(await this.membership.isWithinScope(context, spec.name, id))) {
        this.denials.record(context, {
          reason: 'SCOPE_NOT_ALLOWED',
          entityType: spec.name,
          entityId: id,
          method: request.method,
          path: request.path,
        });
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Not found',
        });
      }
    }
    return true;
  }
}

function readIds(request: RequestWithContext, spec: ScopeParamSpec): string[] {
  const source = request[spec.from] as Record<string, unknown> | undefined;
  const raw = source?.[spec.key];
  if (raw === undefined || raw === null || raw === '') {
    return [];
  }
  return (Array.isArray(raw) ? raw : [raw]).map(String);
}
