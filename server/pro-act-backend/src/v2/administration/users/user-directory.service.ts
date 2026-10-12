import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../../common/context/request-context';
import { User } from '../../../users/user.entity';
import { listResponse, ListResponse } from '../../common/response';
import { PlantUserDirectory } from './plant-user-directory';
import { UserDirectoryQueryDto } from './users-v2.dto';
import { UserDirectoryEntry } from './user-v2.view';

export { escapeLike } from './plant-user-directory';

const toEntry = (
  user: Pick<User, 'id' | 'name' | 'isActive'>,
): UserDirectoryEntry => ({
  id: user.id,
  name: user.name,
  isActive: user.isActive,
});

/**
 * User names for every member of a plant (backend item B2): assignee pickers, actor and assignee names.
 * Members are the users whose home plant it is or who hold a scope grant there, from any plant of the
 * installation (owner decision 2026-10-12, through `PlantUserDirectory`); ids also resolve for users placed
 * in no plant (organization and super administrators). Anything else is left out ("Unknown user").
 */
@Injectable()
export class UserDirectoryService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly plantUsers: PlantUserDirectory,
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
    const page = await this.plantUsers.page(
      { kind: 'plant', tenantId, organizationId: null },
      {
        q: query.q,
        searchEmail: false,
        isActive: true,
        sort: { field: 'name', direction: 'ASC' },
        cursor: query.cursor,
        limit: query.limit,
      },
    );
    return listResponse(page.items.map(toEntry), page.nextCursor, { tenantId });
  }

  /** Names of the given users that the plant may name (members, or users placed in no plant). */
  async namesOf(
    tenantId: string,
    ids: readonly string[],
  ): Promise<UserDirectoryEntry[]> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return [];
    const members = await this.plantUsers.members(tenantId, unique);
    const found = new Set(members.map((member) => member.id));
    const rest = unique.filter((id) => !found.has(id));
    const unplaced = rest.length
      ? await this.users.find({
          where: { id: In(rest), tenantId: IsNull() },
          select: { id: true, name: true, isActive: true },
        })
      : [];
    return [...members, ...unplaced].map(toEntry);
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

  /** Whether the user is an active member of the plant (assignees). */
  async isActiveMember(tenantId: string, userId: string): Promise<boolean> {
    const [member] = await this.plantUsers.members(tenantId, [userId]);
    return member?.isActive === true;
  }
}
