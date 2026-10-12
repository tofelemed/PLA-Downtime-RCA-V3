import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../../common/context/request-context';
import { User } from '../../../users/user.entity';
import { listResponse, ListResponse } from '../../common/response';
import { expressionKeysetPage } from '../common/expression-keyset';
import { UserDirectoryQueryDto } from './users-v2.dto';
import { UserDirectoryEntry } from './user-v2.view';

/**
 * SQL predicate "user `alias` belongs to the plant `:memberTenantId`": its home plant, or a `user_scopes`
 * grant there. Row-level security still applies on top (a non-SuperAdmin caller never reads `users` rows
 * of plants it is not a member of).
 */
export function plantMemberSql(alias: string): string {
  return (
    `("${alias}"."tenant_id" = :memberTenantId OR "${alias}"."id" IN ` +
    `(SELECT "s"."user_id" FROM "user_scopes" "s" WHERE "s"."tenant_id" = :memberTenantId))`
  );
}

const toEntry = (user: User): UserDirectoryEntry => ({
  id: user.id,
  name: user.name,
  isActive: user.isActive,
});

/**
 * User names for every member of a plant (backend item B2): assignee pickers, actor and assignee names.
 * Ids resolve for members of the acting plant, active or not, and for users placed in no plant
 * (organization and super administrators); anything else is left out (the screen shows "Unknown user").
 */
@Injectable()
export class UserDirectoryService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async directory(
    context: RequestContext,
    query: UserDirectoryQueryDto,
  ): Promise<ListResponse<UserDirectoryEntry>> {
    const tenantId = requireTenantId(context);
    if (query.ids?.length) {
      const items = await this.namesOf(tenantId, query.ids);
      return listResponse(items, null, { tenantId });
    }
    const qb = this.users
      .createQueryBuilder('u')
      .select(['u.id', 'u.name', 'u.isActive'])
      .where(plantMemberSql('u'), { memberTenantId: tenantId })
      .andWhere('u.isActive = true');
    if (query.q) {
      qb.andWhere('u.name ILIKE :q', { q: `%${escapeLike(query.q)}%` });
    }
    const page = await expressionKeysetPage(qb, {
      alias: 'u',
      expression: '"u"."name"',
      cast: 'text',
      direction: 'ASC',
      cursor: query.cursor,
      limit: query.limit,
      valueOf: (user) => user.name,
    });
    return listResponse(page.items.map(toEntry), page.nextCursor, { tenantId });
  }

  /** Names of the given users that the plant may name (members, or users placed in no plant). */
  async namesOf(
    tenantId: string,
    ids: readonly string[],
  ): Promise<UserDirectoryEntry[]> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return [];
    const rows = await this.users
      .createQueryBuilder('u')
      .select(['u.id', 'u.name', 'u.isActive'])
      .where({ id: In(unique) })
      .andWhere(
        new Brackets((inner) =>
          inner
            .where(plantMemberSql('u'), { memberTenantId: tenantId })
            .orWhere('u.tenant_id IS NULL'),
        ),
      )
      .getMany();
    return rows.map(toEntry);
  }

  /** id → name map of `namesOf` (views carry names, never ids). */
  async nameMap(
    tenantId: string,
    ids: ReadonlyArray<string | null | undefined>,
  ): Promise<Map<string, string>> {
    const present = ids.filter((id): id is string => Boolean(id));
    const entries = await this.namesOf(tenantId, present);
    return new Map(entries.map((entry) => [entry.id, entry.name]));
  }

  /** Whether the user is an active member of the plant (assignees, grant targets). */
  async isActiveMember(tenantId: string, userId: string): Promise<boolean> {
    const count = await this.users
      .createQueryBuilder('u')
      .where('u.id = :userId', { userId })
      .andWhere('u.isActive = true')
      .andWhere(plantMemberSql('u'), { memberTenantId: tenantId })
      .getCount();
    return count > 0;
  }
}

/** `%`, `_` and `\` of a search text match literally in ILIKE. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}
