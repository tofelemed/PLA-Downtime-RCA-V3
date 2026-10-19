import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RequestContext,
  ScopeGrant,
} from '../../common/context/request-context';
import { Tenant } from '../../tenant/tenant.entity';
import { User } from '../../users/user.entity';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { legacyRolesApplying } from '../roles/role-model';
import { AccessDenialAuditService } from '../scopes/access-denial-audit.service';
import { UserScopesService } from '../scopes/user-scopes.service';

export interface RequestContextInput {
  payload: JwtPayload;
  /** raw `X-Tenant-Id` header value, if any */
  selectedTenant?: string | string[];
  correlationId: string;
  method?: string;
  path?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function tenantNotAllowed(): ForbiddenException {
  return new ForbiddenException({
    code: 'TENANT_NOT_ALLOWED',
    message: 'The selected tenant is not available to this identity',
  });
}

/**
 * Builds the `RequestContext` for an authenticated request (WF05):
 *
 * - roles = legacy role + its D06 mapping + the `user_scopes` roles held in the acting tenant (the
 *   legacy role only counts in the home tenant, except SuperAdmin everywhere and OrgAdmin within its
 *   organization)
 * - tenant = `X-Tenant-Id` when selected and allowed, otherwise the token tenant
 * - SuperAdmin may select any tenant that exists; everyone else only a tenant present in their
 *   scopes; anything else is 403 `TENANT_NOT_ALLOWED` and an audit row.
 */
@Injectable()
export class RequestContextFactory {
  constructor(
    private readonly userScopes: UserScopesService,
    private readonly denials: AccessDenialAuditService,
    @InjectRepository(Tenant)
    private readonly tenants: Repository<Tenant>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async build(input: RequestContextInput): Promise<RequestContext> {
    const { payload } = input;
    const [scopes, legacyRole] = await Promise.all([
      this.userScopes.grantsForUser(payload.sub),
      this.currentLegacyRole(payload),
    ]);
    const homeTenant = payload.tenantId ?? null;
    const context: RequestContext = {
      userId: payload.sub,
      tenantId: homeTenant,
      organizationId: payload.organizationId ?? null,
      legacyRole,
      roles: mergeRoles(legacyRole, scopesIn(scopes, homeTenant)),
      scopes,
      isSuperAdmin: legacyRole === 'SuperAdmin',
      correlationId: input.correlationId,
    };
    const selected = firstHeaderValue(input.selectedTenant);
    if (selected === undefined || selected === homeTenant) {
      return context;
    }
    if (!(await this.maySelectTenant(context, selected))) {
      this.denials.record(context, {
        reason: 'TENANT_NOT_ALLOWED',
        entityType: 'Tenant',
        entityId: selected,
        method: input.method,
        path: input.path,
      });
      throw tenantNotAllowed();
    }
    // Roles are those held in the selected tenant: never carry the home tenant's roles over
    const legacyApplies = await this.legacyRoleAppliesIn(context, selected);
    return {
      ...context,
      tenantId: selected,
      legacyRole: legacyApplies ? legacyRole : null,
      roles: mergeRoles(
        legacyApplies ? legacyRole : null,
        scopesIn(scopes, selected),
      ),
    };
  }

  /**
   * The user's role as stored now, so a downgrade or deactivation applies on the next request rather
   * than at token expiry (plan 3.11). An identity without a `users` row keeps the token's role.
   */
  private async currentLegacyRole(payload: JwtPayload): Promise<string | null> {
    if (!UUID.test(payload.sub)) return payload.role ?? null;
    const user = await this.users.findOne({
      where: { id: payload.sub },
      select: { id: true, role: true, isActive: true },
    });
    if (!user) return payload.role ?? null;
    if (!user.isActive) throw new UnauthorizedException('Account is inactive');
    return user.role ?? null;
  }

  /**
   * A legacy `users.role` belongs to the token's home tenant. Outside it only SuperAdmin keeps it
   * everywhere, and OrgAdmin inside tenants of its own organization.
   */
  private async legacyRoleAppliesIn(
    context: RequestContext,
    tenantId: string,
  ): Promise<boolean> {
    if (context.isSuperAdmin) {
      return true;
    }
    if (context.legacyRole !== 'OrgAdmin' || !context.organizationId) {
      return false;
    }
    return (
      (await this.tenants.countBy({
        id: tenantId,
        organizationId: context.organizationId,
      })) > 0
    );
  }

  /**
   * Whether the caller may act on `tenantId`: SuperAdmin on any tenant that exists, everyone else on
   * a tenant present in their scopes. Shared with `TenantBindingGuard` (a tenant named in a v1 body).
   */
  async maySelectTenant(
    context: RequestContext,
    tenantId: string,
  ): Promise<boolean> {
    if (!UUID.test(tenantId)) {
      return false;
    }
    if (context.isSuperAdmin) {
      return (await this.tenants.countBy({ id: tenantId })) > 0;
    }
    return context.scopes.some((scope) => scope.tenantId === tenantId);
  }
}

function scopesIn(scopes: ScopeGrant[], tenantId: string | null): ScopeGrant[] {
  return tenantId ? scopes.filter((scope) => scope.tenantId === tenantId) : [];
}

/** Legacy role + its D06 mapping only while no own grant is held in the plant (`legacyRolesApplying`). */
function mergeRoles(legacyRole: string | null, scopes: ScopeGrant[]): string[] {
  const ownGrant = scopes.some((scope) => !scope.delegationId);
  return [
    ...new Set([
      ...legacyRolesApplying(legacyRole, ownGrant),
      ...scopes.map((scope) => scope.role),
    ]),
  ];
}

function firstHeaderValue(value?: string | string[]): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  const trimmed = first?.trim();
  return trimmed ? trimmed : undefined;
}
