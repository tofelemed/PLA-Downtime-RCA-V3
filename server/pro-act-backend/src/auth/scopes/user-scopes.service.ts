import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScopeGrant } from '../../common/context/request-context';
import { delegatedGrants } from '../delegations/delegated-grants';
import { UserScope } from './user-scope.entity';

/** Reads `user_scopes` for identity resolution and writes the default tenant scope of new users. */
@Injectable()
export class UserScopesService {
  constructor(
    @InjectRepository(UserScope)
    private readonly scopes: Repository<UserScope>,
  ) {}

  /**
   * The user's own `user_scopes` grants plus, SME R1 / R6, the grants held now as a delegate (marked with
   * the delegation), so every role check, scope filter and capability treats a delegate like a holder.
   */
  async grantsForUser(
    userId: string,
    at: Date = new Date(),
  ): Promise<ScopeGrant[]> {
    const rows = await this.scopes.find({
      where: { userId },
      select: ['scopeKind', 'scopeId', 'role', 'tenantId'],
    });
    const own: ScopeGrant[] = rows.map((row) => ({
      kind: row.scopeKind,
      id: row.scopeId,
      role: row.role,
      tenantId: row.tenantId,
    }));
    return [
      ...own,
      ...(await delegatedGrants(this.scopes.manager, userId, at)),
    ];
  }

  /** Tenant-wide membership for a freshly registered user (what the backfill did for existing ones). */
  async grantTenantScope(
    userId: string,
    tenantId: string,
    role: string,
    grantedBy: string | null,
  ): Promise<void> {
    await this.scopes
      .createQueryBuilder()
      .insert()
      .values({
        userId,
        tenantId,
        scopeKind: 'tenant',
        scopeId: tenantId,
        role,
        createdBy: grantedBy,
        updatedBy: grantedBy,
      })
      .orIgnore()
      .execute();
  }
}
