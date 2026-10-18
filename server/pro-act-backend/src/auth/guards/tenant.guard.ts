import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const tenantId =
      request.params.tenantId ||
      request.query.tenantId ||
      request.body.tenantId;

    // SuperAdmin can access all tenants
    if (user.role === 'SuperAdmin') {
      return true;
    }

    // Users can only access their own tenant
    if (tenantId && user.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied: Tenant mismatch');
    }

    return true;
  }
}
