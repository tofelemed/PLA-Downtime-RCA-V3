import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { User } from '../../users/user.entity';

export const SCOPE_KINDS = ['tenant', 'site', 'unit'] as const;
export type UserScopeKind = (typeof SCOPE_KINDS)[number];

/**
 * Membership of a user in a tenant, site or unit with a role (WF05, §13.2). A `tenant` scope covers
 * every site and unit of that tenant. The migration `UserScopesAndIdempotency` seeds one tenant
 * scope per existing user from `users.tenant_id` / `users.role` (D06 mapping).
 */
@Entity('user_scopes')
@Unique('UQ_user_scopes_user_scope_role', [
  'userId',
  'scopeKind',
  'scopeId',
  'role',
])
@Index('IDX_user_scopes_tenant_user', ['tenantId', 'userId'])
@Index('IDX_user_scopes_user', ['userId'])
export class UserScope extends TenantScopedEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    name: 'scope_kind',
    type: 'enum',
    enum: SCOPE_KINDS,
    enumName: 'user_scope_kind',
  })
  scopeKind: UserScopeKind;

  /** tenants.id, sites.id or units.id depending on `scopeKind` */
  @Column({ name: 'scope_id', type: 'uuid' })
  scopeId: string;

  @Column({ name: 'role', type: 'varchar', length: 50 })
  role: string;
}
