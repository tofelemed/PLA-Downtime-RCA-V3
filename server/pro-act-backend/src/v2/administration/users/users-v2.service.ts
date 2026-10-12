import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  canGrantRole,
  LEGACY_ROLES,
  SCOPE_ROLES,
} from '../../../auth/roles/role-model';
import {
  RequestContext,
  requireTenantId,
} from '../../../common/context/request-context';
import { listResponse, ListResponse } from '../../common/response';
import { parseSort } from '../../common/sort-spec';
import { PlaceNamesService } from '../common/place-names.service';
import {
  DirectorySortField,
  DirectoryUser,
  PlantUserDirectory,
  UserSource,
} from './plant-user-directory';
import { permissionsOf } from './user-manage-rules';
import { UsersListQueryDto } from './users-v2.dto';
import { GrantableRolesView, toUserView, UserV2View } from './user-v2.view';

const SORT_FIELDS = [
  'name',
  'createdAt',
] as const satisfies readonly DirectorySortField[];

/**
 * Reads of the administration API's users (owner requirement "v2 only"): the members of the acting plant
 * — home plant or a scope grant there, from any plant (owner decision 2026-10-12, `PlantUserDirectory`) —
 * plus organization-level users for organization and super administrators. Keyset by name or creation.
 */
@Injectable()
export class UsersV2Service {
  constructor(
    private readonly directory: PlantUserDirectory,
    private readonly places: PlaceNamesService,
  ) {}

  async list(
    context: RequestContext,
    query: UsersListQueryDto,
  ): Promise<ListResponse<UserV2View>> {
    const tenantId = requireTenantId(context);
    const source = await this.source(context, query.reach ?? 'plant');
    const sort = parseSort<DirectorySortField>(query.sort, SORT_FIELDS, {
      field: 'name',
      direction: 'ASC',
    });
    const page = await this.directory.page(source, {
      q: query.q,
      searchEmail: true,
      roles: query.roles,
      isActive: query.isActive,
      sort,
      cursor: query.cursor,
      limit: query.limit,
    });
    const items = await this.toViews(context, page.items);
    return listResponse(items, page.nextCursor, { tenantId });
  }

  async get(context: RequestContext, id: string): Promise<UserV2View> {
    const [view] = await this.toViews(context, [
      await this.findReachable(context, id),
    ]);
    return view;
  }

  /** The user if the caller may see it (404 otherwise: no existence leak). */
  async findReachable(
    context: RequestContext,
    id: string,
  ): Promise<DirectoryUser> {
    const source = await this.source(
      context,
      context.isSuperAdmin ? 'everyone' : 'plant',
    );
    const user = await this.directory.one(source, id);
    if (!user) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    }
    return user;
  }

  /** The user with exactly this e-mail in the acting plant's organization (404 otherwise). */
  async lookup(context: RequestContext, email: string): Promise<UserV2View> {
    const user = await this.directory.byEmail(requireTenantId(context), email);
    if (!user) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    }
    const [view] = await this.toViews(context, [user]);
    return view;
  }

  grantableRoles(context: RequestContext): GrantableRolesView {
    return {
      roles: LEGACY_ROLES.filter((role) => canGrantRole(context.roles, role)),
      scopeRoles: SCOPE_ROLES.filter((role) =>
        canGrantRole(context.roles, role),
      ),
    };
  }

  async toViews(
    context: RequestContext,
    users: DirectoryUser[],
  ): Promise<UserV2View[]> {
    const names = await this.places.namesFor(users);
    return users.map((user) =>
      toUserView(user, names, permissionsOf(context, user)),
    );
  }

  private async source(
    context: RequestContext,
    reach: 'plant' | 'everyone',
  ): Promise<UserSource> {
    if (reach === 'everyone') {
      if (!context.isSuperAdmin) {
        throw new ForbiddenException({
          code: 'FORBIDDEN_ROLE',
          message: 'Only a super administrator can list every user',
        });
      }
      return { kind: 'everyone' };
    }
    const tenantId = requireTenantId(context);
    const seesOrganization =
      context.isSuperAdmin || context.legacyRole === 'OrgAdmin';
    const organizationId = seesOrganization
      ? await this.places.organizationOf(tenantId)
      : null;
    return { kind: 'plant', tenantId, organizationId };
  }
}
