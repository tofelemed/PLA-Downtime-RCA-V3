import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UserScope } from '../../../auth/scopes/user-scope.entity';
import { Site } from '../../../calendar/entities/site.entity';
import {
  RequestContext,
  requireTenantId,
} from '../../../common/context/request-context';
import { scopedQuery } from '../../../common/query/scoped-query';
import { Unit } from '../../../unit/unit.entity';
import { User } from '../../../users/user.entity';
import { keysetPage } from '../../common/keyset-page';
import { listResponse, ListResponse } from '../../common/response';
import { parseSort } from '../../common/sort-spec';
import { PlaceNamesService } from '../common/place-names.service';
import { PlantUserDirectory } from '../users/plant-user-directory';
import {
  assertMayGrant,
  assertNotLocked,
  GrantHolder,
  revokeLock,
} from './scope-grant-rules';
import {
  GrantUserScopeDto,
  UserScopesListQueryDto,
} from './user-scopes-v2.dto';
import { toUserScopeView, UserScopeV2View } from './user-scope-v2.view';

const notFound = () =>
  new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });

/**
 * Scope grants of the acting plant (persona gap "no scope-grant screen"): list, grant and revoke roles
 * such as viewer, reliability engineer, integration or master-data administrator, for the whole plant or
 * one unit. Rules in `scope-grant-rules.ts`; writes are audited by the global audit interceptor.
 */
@Injectable()
export class UserScopesV2Service {
  constructor(
    @InjectRepository(UserScope) private readonly scopes: Repository<UserScope>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Unit) private readonly units: Repository<Unit>,
    @InjectRepository(Site) private readonly sites: Repository<Site>,
    private readonly places: PlaceNamesService,
    private readonly plantUsers: PlantUserDirectory,
  ) {}

  async list(
    context: RequestContext,
    query: UserScopesListQueryDto,
  ): Promise<ListResponse<UserScopeV2View>> {
    const tenantId = requireTenantId(context);
    const qb = scopedQuery(this.scopes, 's', { context });
    if (query.userId)
      qb.andWhere('s.userId = :userId', { userId: query.userId });
    const sort = parseSort(query.sort, ['createdAt'] as const, {
      field: 'createdAt',
      direction: 'DESC',
    });
    const page = await keysetPage(qb, {
      alias: 's',
      property: 'createdAt',
      direction: sort.direction,
      cursor: query.cursor,
      limit: query.limit,
    });
    const items = await this.toViews(context, page.items);
    return listResponse(items, page.nextCursor, { tenantId });
  }

  async grant(
    context: RequestContext,
    body: GrantUserScopeDto,
  ): Promise<UserScopeV2View> {
    const tenantId = requireTenantId(context);
    const holder = await this.grantee(tenantId, body);
    if (!holder) throw notFound();
    assertMayGrant(context, holder, body.role);
    const scopeKind = body.unitId ? 'unit' : 'tenant';
    const scopeId = body.unitId ?? tenantId;
    if (body.unitId) await this.assertUnitOfPlant(context, body.unitId);
    const exists = await this.scopes.count({
      where: { userId: holder.id, scopeKind, scopeId, role: body.role },
    });
    if (exists > 0) {
      throw new ConflictException({
        code: 'SCOPE_EXISTS',
        message: 'The user already holds this role here',
      });
    }
    const saved = await this.scopes.save(
      this.scopes.create({
        tenantId,
        userId: holder.id,
        scopeKind,
        scopeId,
        role: body.role,
        createdBy: context.userId,
        updatedBy: context.userId,
      }),
    );
    const [view] = await this.toViews(context, [saved]);
    return view;
  }

  async revoke(context: RequestContext, id: string): Promise<void> {
    const scope = await scopedQuery(this.scopes, 's', { context })
      .andWhere('s.id = :id', { id })
      .getOne();
    if (!scope) throw notFound();
    const [holder] = await this.holders(scope.tenantId, [scope.userId]);
    assertNotLocked(revokeLock(context, scope, holder));
    await this.scopes.delete({ id: scope.id, tenantId: scope.tenantId });
  }

  /**
   * Who receives a new grant: a user the plant may see (`userId`), or — for a first grant into the plant —
   * the user with exactly this e-mail in the plant's organization (`email`, never a fuzzy search).
   */
  private async grantee(
    tenantId: string,
    body: GrantUserScopeDto,
  ): Promise<GrantHolder | undefined> {
    if (body.userId && body.email) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_FAILED',
        message: 'Send either userId or email, not both',
      });
    }
    if (body.email) return this.plantUsers.byEmail(tenantId, body.email);
    if (!body.userId) return undefined;
    const [holder] = await this.holders(tenantId, [body.userId]);
    return holder;
  }

  /**
   * Holders and granters by id: members of the plant from any plant (`PlantUserDirectory`), then the users
   * row-level security lets the caller see (members of its own plants, users placed in no plant).
   */
  private async holders(
    tenantId: string,
    ids: readonly string[],
  ): Promise<Array<GrantHolder & { name: string }>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return [];
    const members = await this.plantUsers.members(tenantId, unique);
    const found = new Set(members.map((member) => member.id));
    const rest = unique.filter((id) => !found.has(id));
    const visible = rest.length
      ? await this.users.find({
          where: { id: In(rest) },
          select: {
            id: true,
            name: true,
            role: true,
            tenantId: true,
            organizationId: true,
            isActive: true,
          },
        })
      : [];
    const all = [
      ...members,
      ...visible.map((row) => ({
        ...row,
        tenantId: row.tenantId ?? null,
        organizationId: row.organizationId ?? null,
      })),
    ];
    return this.withHomePlantRoles(all);
  }

  /** Each holder's plant-wide grant roles in its home plant (one query), for the home-role mirror lock. */
  private async withHomePlantRoles<T extends GrantHolder>(
    holders: T[],
  ): Promise<T[]> {
    const homed = holders.filter((holder) => holder.tenantId);
    if (homed.length === 0) return holders;
    const rows = await this.scopes.find({
      where: {
        userId: In(homed.map((holder) => holder.id)),
        scopeKind: 'tenant',
      },
      select: { userId: true, tenantId: true, role: true },
    });
    return holders.map((holder) => ({
      ...holder,
      homePlantRoles: rows
        .filter(
          (row) => row.userId === holder.id && row.tenantId === holder.tenantId,
        )
        .map((row) => row.role),
    }));
  }

  private async assertUnitOfPlant(
    context: RequestContext,
    unitId: string,
  ): Promise<void> {
    const found = await scopedQuery(this.units, 'unit', { context })
      .andWhere('unit.id = :unitId', { unitId })
      .getCount();
    if (found === 0) {
      throw new UnprocessableEntityException({
        code: 'INVALID_REFERENCE',
        message: 'The unit is not part of this plant',
      });
    }
  }

  private async toViews(
    context: RequestContext,
    rows: UserScope[],
  ): Promise<UserScopeV2View[]> {
    const people = rows.flatMap((row) =>
      row.createdBy ? [row.userId, row.createdBy] : [row.userId],
    );
    const [holders, scopeNames] = await Promise.all([
      this.holders(requireTenantId(context), people),
      this.scopeNames(rows),
    ]);
    const byId = new Map(holders.map((holder) => [holder.id, holder]));
    const userNames = new Map(
      holders.map((holder) => [holder.id, holder.name]),
    );
    return rows.map((row) =>
      toUserScopeView(row, {
        userNames,
        scopeNames,
        lockOf: (scope) => revokeLock(context, scope, byId.get(scope.userId)),
      }),
    );
  }

  private async scopeNames(
    rows: readonly UserScope[],
  ): Promise<Map<string, string>> {
    const idsOf = (kind: UserScope['scopeKind']) =>
      rows.filter((row) => row.scopeKind === kind).map((row) => row.scopeId);
    const unitIds = [...new Set(idsOf('unit'))];
    const siteIds = [...new Set(idsOf('site'))];
    const [tenants, units, sites] = await Promise.all([
      this.places.tenantNames(idsOf('tenant')),
      unitIds.length
        ? this.units.find({
            where: { id: In(unitIds) },
            select: { id: true, name: true },
          })
        : [],
      siteIds.length
        ? this.sites.find({
            where: { id: In(siteIds) },
            select: { id: true, name: true },
          })
        : [],
    ]);
    const names = new Map(tenants);
    for (const row of [...units, ...sites]) names.set(row.id, row.name);
    return names;
  }
}
