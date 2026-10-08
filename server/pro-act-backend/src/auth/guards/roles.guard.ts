import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getRequestContext } from '../../common/context/request-context';
import { RequestWithContext } from '../../common/context/request-context.middleware';
import { isPublicRoute } from '../../common/decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { satisfiesRole } from '../roles/role-model';
import { AccessDenialAuditService } from '../scopes/access-denial-audit.service';

/**
 * Global guard: a handler or controller decorated with `@Roles(...)` admits callers whose request
 * context holds one of them (legacy roles, their D06 mapping and scope roles; SuperAdmin passes
 * everything, OrgAdmin everything but SuperAdmin). Denials are audited and answered with 403.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly denials: AccessDenialAuditService,
  ) {}

  canActivate(executionContext: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      executionContext.getHandler(),
      executionContext.getClass(),
    ]);
    if (!required?.length || isPublicRoute(this.reflector, executionContext)) {
      return true;
    }
    const request = executionContext.switchToHttp().getRequest<RequestWithContext>();
    const context = request.requestContext ?? getRequestContext();
    if (!context?.userId) {
      throw new UnauthorizedException('Unauthorized');
    }
    if (required.some((role) => satisfiesRole(context.roles, role))) {
      return true;
    }
    this.denials.record(context, {
      reason: 'ROLE_NOT_ALLOWED',
      entityType: 'Route',
      entityId: `${request.method} ${request.path}`,
      method: request.method,
      path: request.path,
    });
    throw new ForbiddenException({
      code: 'FORBIDDEN_ROLE',
      message: `Requires one of: ${required.join(', ')}`,
    });
  }
}
