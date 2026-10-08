import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * v2 resolves the tenant from the verified identity (WF05). A `tenantId` query parameter is rejected
 * outright so clients cannot even appear to select a tenant that way.
 */
@Injectable()
export class TenantQueryParamGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (
      request.query &&
      Object.prototype.hasOwnProperty.call(request.query, 'tenantId')
    ) {
      throw new BadRequestException({
        code: 'TENANT_FROM_IDENTITY',
        message:
          'tenantId is derived from the access token and must not be passed as a query parameter',
      });
    }
    return true;
  }
}
