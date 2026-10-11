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
import { RequestContextFactory } from '../context/request-context.factory';
import {
  TENANT_BOUND_KEY,
  TenantBoundSpec,
} from '../decorators/tenant-bound.decorator';
import { AccessDenialAuditService } from '../scopes/access-denial-audit.service';
import { ScopeMembershipService } from '../scopes/scope-membership.service';

const MUTATING_METHODS: ReadonlySet<string> = new Set([
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
]);

export function tenantMismatch(): ForbiddenException {
  return new ForbiddenException({
    code: 'TENANT_MISMATCH',
    message: 'The tenant named in the request is not the tenant you act on',
  });
}

/**
 * Global guard for `@TenantBound()` v1 routes: a `tenantId` carried in the body or the query is checked
 * against the acting tenant (`RequestContext.tenantId`, i.e. `X-Tenant-Id` or the token tenant).
 *
 * - a write may only name the acting tenant; SuperAdmin / OrgAdmin may name a tenant they could select
 * - a read may also name any tenant within the caller's scopes (a viewer lists its read-only plant)
 * - anything else is 403 `TENANT_MISMATCH`, audited
 * - a POST body naming no tenant gets the acting tenant (`fill`), so a create never falls back to a
 *   tenant the caller did not act on
 *
 * Runs after `WriteAccessGuard`, so a read-only caller still sees `READ_ONLY_ROLE` first.
 */
@Injectable()
export class TenantBindingGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly membership: ScopeMembershipService,
    private readonly contexts: RequestContextFactory,
    private readonly denials: AccessDenialAuditService,
  ) {}

  async canActivate(executionContext: ExecutionContext): Promise<boolean> {
    if (executionContext.getType() !== 'http') return true;
    const spec = this.reflector.getAllAndOverride<TenantBoundSpec | undefined>(
      TENANT_BOUND_KEY,
      [executionContext.getHandler(), executionContext.getClass()],
    );
    if (!spec || isPublicRoute(this.reflector, executionContext)) return true;
    const request = executionContext
      .switchToHttp()
      .getRequest<RequestWithContext>();
    const context = request.requestContext ?? getRequestContext();
    if (!context?.userId) return true; // JwtAuthGuard already rejected anonymous callers

    const body = plainRecord(request.body);
    const claimed = new Set([
      ...readTenantIds(body),
      ...readTenantIds(plainRecord(request.query)),
    ]);
    if (claimed.size === 0) {
      if (spec.fill && request.method === 'POST' && body && context.tenantId) {
        body.tenantId = context.tenantId;
      }
      return true;
    }
    const mutating = MUTATING_METHODS.has(request.method);
    for (const tenantId of claimed) {
      if (await this.allows(context, tenantId, mutating)) continue;
      this.denials.record(context, {
        reason: 'TENANT_MISMATCH',
        entityType: 'Tenant',
        entityId: tenantId,
        method: request.method,
        path: request.path,
      });
      throw tenantMismatch();
    }
    return true;
  }

  private async allows(
    context: RequestContext,
    tenantId: string,
    mutating: boolean,
  ): Promise<boolean> {
    if (tenantId === context.tenantId) return true;
    if (
      !mutating &&
      (await this.membership.isWithinScope(context, 'tenantId', tenantId))
    ) {
      return true;
    }
    if (!context.isSuperAdmin && context.legacyRole !== 'OrgAdmin') {
      return false;
    }
    return this.contexts.maySelectTenant(context, tenantId);
  }
}

function plainRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** The `tenantId` value(s) of a body or query, as strings; absent, null and empty count as none. */
export function readTenantIds(
  source: Record<string, unknown> | undefined,
): string[] {
  const raw = source?.tenantId;
  if (raw === undefined || raw === null || raw === '') return [];
  return (Array.isArray(raw) ? raw : [raw]).map(String);
}
