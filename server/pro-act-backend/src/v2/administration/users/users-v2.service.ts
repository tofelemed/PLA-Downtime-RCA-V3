import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { assertCallerMayManage } from '../../../auth/roles/grant-policy';
import {
  canGrantRole,
  LEGACY_ROLES,
  SCOPE_ROLES,
} from '../../../auth/roles/role-model';
import {
  RequestContext,
  requireTenantId,
} from '../../../common/context/request-context';
import { User } from '../../../users/user.entity';
import { listResponse, ListResponse } from '../../common/response';
import { parseSort } from '../../common/sort-spec';
import { expressionKeysetPage } from '../common/expression-keyset';
import { PlaceNamesService } from '../common/place-names.service';
import { escapeLike, plantMemberSql } from './user-directory.service';
import { UsersListQueryDto } from './users-v2.dto';
import { GrantableRolesView, toUserView, UserV2View } from './user-v2.view';

type UserSortField = 'name' | 'createdAt';
const SORT_FIELDS = [
  'name',
  'createdAt',
] as const satisfies readonly UserSortField[];
const SORT_SQL: Record<
  UserSortField,
  { expression: string; cast: 'text' | 'timestamptz' }
> = {
  name: { expression: '"u"."name"', cast: 'text' },
  createdAt: {
    expression: `date_trunc('milliseconds', "u"."created_at")`,
    cast: 'timestamptz',
  },
};

/** Whether the caller may manage the user (grant-policy rank and reach rules), as a flag for the view. */
export function mayManage(context: RequestContext, user: User): boolean {
  try {
    assertCallerMayManage(context, user);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads of the administration API's users (owner requirement "v2 only"): the members of the acting plant,
 * plus organization-level users for organization and super administrators. Keyset by name or creation.
 */
@Injectable()
export class UsersV2Service {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly places: PlaceNamesService,
  ) {}

  async list(
    context: RequestContext,
    query: UsersListQueryDto,
  ): Promise<ListResponse<UserV2View>> {
    const tenantId = requireTenantId(context);
    const qb = await this.reachable(context, query.reach ?? 'plant');
    applyFilters(qb, query);
    const sort = parseSort<UserSortField>(query.sort, SORT_FIELDS, {
      field: 'name',
      direction: 'ASC',
    });
    const page = await expressionKeysetPage(qb, {
      alias: 'u',
      ...SORT_SQL[sort.field],
      direction: sort.direction,
      cursor: query.cursor,
      limit: query.limit,
      valueOf: (user) =>
        sort.field === 'name'
          ? user.name
          : new Date(user.createdAt).toISOString(),
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
  async findReachable(context: RequestContext, id: string): Promise<User> {
    const qb = await this.reachable(
      context,
      context.isSuperAdmin ? 'everyone' : 'plant',
    );
    const user = await qb.andWhere('u.id = :id', { id }).getOne();
    if (!user) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    }
    return user;
  }

  grantableRoles(context: RequestContext): GrantableRolesView {
    return {
      roles: LEGACY_ROLES.filter((role) => canGrantRole(context.roles, role)),
      scopeRoles: SCOPE_ROLES.filter((role) =>
        canGrantRole(context.roles, role),
      ),
    };
  }

  async toViews(context: RequestContext, users: User[]): Promise<UserV2View[]> {
    const names = await this.places.namesFor(users);
    return users.map((user) =>
      toUserView(user, names, mayManage(context, user)),
    );
  }

  private async reachable(
    context: RequestContext,
    reach: 'plant' | 'everyone',
  ): Promise<SelectQueryBuilder<User>> {
    const qb = this.users.createQueryBuilder('u');
    if (reach === 'everyone') {
      if (!context.isSuperAdmin) {
        throw new ForbiddenException({
          code: 'FORBIDDEN_ROLE',
          message: 'Only a super administrator can list every user',
        });
      }
      return qb;
    }
    const tenantId = requireTenantId(context);
    const organizationId = await this.places.organizationOf(tenantId);
    const seesOrganization =
      context.isSuperAdmin || context.legacyRole === 'OrgAdmin';
    return qb.where(
      new Brackets((inner) => {
        inner.where(plantMemberSql('u'), { memberTenantId: tenantId });
        if (seesOrganization && organizationId) {
          inner.orWhere(
            '(u.tenant_id IS NULL AND u.organization_id = :orgId)',
            {
              orgId: organizationId,
            },
          );
        }
      }),
    );
  }
}

function applyFilters(
  qb: SelectQueryBuilder<User>,
  query: UsersListQueryDto,
): void {
  if (query.q) {
    qb.andWhere('(u.name ILIKE :q OR u.email ILIKE :q)', {
      q: `%${escapeLike(query.q)}%`,
    });
  }
  if (query.roles?.length) {
    qb.andWhere('u.role IN (:...roles)', { roles: query.roles });
  }
  if (query.isActive !== undefined) {
    qb.andWhere('u.isActive = :isActive', { isActive: query.isActive });
  }
}
