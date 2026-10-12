import {
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  assertCallerMayGrant,
  assertCallerMayRegister,
} from '../../../auth/roles/grant-policy';
import { mapLegacyRole } from '../../../auth/roles/role-model';
import { UserScope } from '../../../auth/scopes/user-scope.entity';
import { UserScopesService } from '../../../auth/scopes/user-scopes.service';
import { RequestContext } from '../../../common/context/request-context';
import { UsersService } from '../../../users/users.service';
import { PlaceNamesService } from '../common/place-names.service';
import { DirectoryUser } from './plant-user-directory';
import { assertMayEditProfile } from './user-manage-rules';
import { CreateUserV2Dto, UpdateUserV2Dto } from './users-v2.dto';
import { UserV2View } from './user-v2.view';
import { UsersV2Service } from './users-v2.service';

/** Roles that live above any plant (they may be created without a home plant). */
const GLOBAL_ROLES: ReadonlySet<string> = new Set(['SuperAdmin', 'OrgAdmin']);

/** The keys of `patch` whose value is set (an empty PATCH changes nothing). */
function definedOnly<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

function refuseSelf(code: string, message: string): never {
  throw new UnprocessableEntityException({ code, message });
}

/**
 * User writes of the administration API, on the v1 grant policy (`grant-policy.ts`): a role at most the
 * caller's rank, placed in the caller's plant / organization unless SuperAdmin, and only users ranked
 * strictly below the caller are edited, deactivated or deleted, and only from their home plant (a user
 * granted in from another plant keeps its profile there, `assertMayEditProfile`). A new plant user gets the tenant scope of
 * its role (as registration does); a role change moves that home scope with it, so a demoted user keeps
 * no approver rights through a stale scope row.
 */
@Injectable()
export class UsersV2CommandsService {
  constructor(
    @InjectRepository(UserScope) private readonly scopes: Repository<UserScope>,
    private readonly legacyUsers: UsersService,
    private readonly userScopes: UserScopesService,
    private readonly reads: UsersV2Service,
    private readonly places: PlaceNamesService,
  ) {}

  async create(
    context: RequestContext,
    body: CreateUserV2Dto,
  ): Promise<UserV2View> {
    const placed = await this.placement(context, body);
    assertCallerMayRegister(context, { role: body.role, ...placed });
    await this.assertEmailFree(body.email);
    const user = await this.legacyUsers.create({
      name: body.name.trim(),
      email: body.email.trim(),
      password: body.password,
      role: body.role,
      tenantId: placed.tenantId,
      organizationId: placed.organizationId,
      isActive: body.isActive ?? true,
    });
    if (placed.tenantId) {
      await this.userScopes.grantTenantScope(
        user.id,
        placed.tenantId,
        mapLegacyRole(body.role),
        context.userId,
      );
    }
    return this.reads.get(context, user.id);
  }

  async update(
    context: RequestContext,
    id: string,
    body: UpdateUserV2Dto,
  ): Promise<UserV2View> {
    const target = await this.reads.findReachable(context, id);
    if (id === context.userId && body.isActive === false) {
      refuseSelf(
        'CANNOT_DEACTIVATE_SELF',
        'You cannot deactivate your own account',
      );
    }
    assertMayEditProfile(context, target);
    const roleChanged = body.role !== undefined && body.role !== target.role;
    if (roleChanged) assertCallerMayGrant(context, body.role);
    if (body.email && body.email.toLowerCase() !== target.email.toLowerCase()) {
      await this.assertEmailFree(body.email);
    }
    const patch = definedOnly({
      name: body.name?.trim(),
      email: body.email?.trim(),
      role: body.role,
      isActive: body.isActive,
      password: body.password,
    });
    if (Object.keys(patch).length > 0) await this.legacyUsers.update(id, patch);
    if (roleChanged && body.role) await this.moveHomeScope(target, body.role);
    return this.reads.get(context, id);
  }

  async remove(context: RequestContext, id: string): Promise<void> {
    const target = await this.reads.findReachable(context, id);
    if (id === context.userId) {
      refuseSelf('CANNOT_DELETE_SELF', 'You cannot delete your own account');
    }
    assertMayEditProfile(context, target);
    await this.legacyUsers.remove(id);
  }

  /** Home plant and organization of a new user: the acting plant unless a global role or a SuperAdmin choice. */
  private async placement(
    context: RequestContext,
    body: CreateUserV2Dto,
  ): Promise<{ tenantId?: string; organizationId?: string }> {
    const tenantId =
      body.tenantId ??
      (GLOBAL_ROLES.has(body.role)
        ? undefined
        : (context.tenantId ?? undefined));
    const plantOrganization = tenantId
      ? await this.places.organizationOf(tenantId)
      : null;
    if (tenantId && !plantOrganization) {
      throw new UnprocessableEntityException({
        code: 'INVALID_REFERENCE',
        message: 'The plant does not exist',
      });
    }
    if (
      body.organizationId &&
      plantOrganization &&
      body.organizationId !== plantOrganization
    ) {
      throw new UnprocessableEntityException({
        code: 'INVALID_REFERENCE',
        message: 'The plant belongs to another organization',
      });
    }
    const organizationId =
      body.organizationId ??
      plantOrganization ??
      context.organizationId ??
      undefined;
    return { tenantId, organizationId };
  }

  private async assertEmailFree(email: string): Promise<void> {
    const existing = await this.legacyUsers.findByEmail(email);
    if (existing) {
      throw new ConflictException({
        code: 'EMAIL_EXISTS',
        message: 'A user with this e-mail already exists',
      });
    }
  }

  /** The home-plant scope row that mirrors the old role follows the new one (or goes, if already held). */
  private async moveHomeScope(
    target: DirectoryUser,
    role: string,
  ): Promise<void> {
    if (!target.tenantId) return;
    const home = {
      userId: target.id,
      scopeKind: 'tenant' as const,
      scopeId: target.tenantId,
    };
    const oldRole = mapLegacyRole(target.role);
    const newRole = mapLegacyRole(role);
    if (oldRole === newRole) return;
    const held = await this.scopes.count({ where: { ...home, role: newRole } });
    if (held > 0) {
      await this.scopes.delete({ ...home, role: oldRole });
      return;
    }
    await this.scopes.update({ ...home, role: oldRole }, { role: newRole });
  }
}
