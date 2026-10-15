import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantOwnedEntity } from '../../common/entities/tenant-scoped.entity';
import { User } from '../../users/user.entity';

/** SME R1 / R6: approval roles a holder may hand to a delegate for a limited time. */
export const DELEGABLE_ROLES = [
  'manager_approver',
  'production_accountant',
  'finance_approver',
  'quality_approver',
  'metrology_approver',
] as const;
export type DelegableRole = (typeof DELEGABLE_ROLES)[number];

export const DELEGATION_SCOPE_KINDS = ['tenant', 'site', 'unit'] as const;
export type DelegationScopeKind = (typeof DELEGATION_SCOPE_KINDS)[number];

/**
 * A time-boxed delegation of an approval role (SME R1 "use a delegate if necessary", R6 reassignment):
 * who hands which role on which scope (plant, site or unit) to whom, from / until (half-open, UTC) and why.
 * While in force the delegate holds the role exactly like a scope grant; separation of duties applies to
 * the delegate as to anyone (never approving their own work). Revocation is recorded, rows are never
 * deleted.
 */
@Entity('role_delegations')
@Index('IDX_role_delegations_delegate_until', ['delegateId', 'validUntil'])
@Index('IDX_role_delegations_tenant_created', ['tenantId', 'createdAt', 'id'])
@Index('IDX_role_delegations_delegator', ['delegatorId'])
@Check('CHK_role_delegations_interval', '"valid_until" > "valid_from"')
@Check('CHK_role_delegations_parties', '"delegate_id" <> "delegator_id"')
@Check(
  'CHK_role_delegations_role',
  `"role" IN ('manager_approver', 'production_accountant', 'finance_approver', 'quality_approver', 'metrology_approver')`,
)
@Check(
  'CHK_role_delegations_scope_kind',
  `"scope_kind" IN ('tenant', 'site', 'unit')`,
)
export class RoleDelegation extends TenantOwnedEntity {
  @Column({ name: 'delegator_id', type: 'uuid' })
  delegatorId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'delegator_id',
    foreignKeyConstraintName: 'FK_role_delegations_delegator',
  })
  delegator?: User;

  @Column({ name: 'delegate_id', type: 'uuid' })
  delegateId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'delegate_id',
    foreignKeyConstraintName: 'FK_role_delegations_delegate',
  })
  delegate?: User;

  @Column({ name: 'role', type: 'varchar', length: 50 })
  role: DelegableRole;

  @Column({ name: 'scope_kind', type: 'varchar', length: 16 })
  scopeKind: DelegationScopeKind;

  /** tenants.id, sites.id or units.id depending on `scopeKind` */
  @Column({ name: 'scope_id', type: 'uuid' })
  scopeId: string;

  @Column({ name: 'valid_from', type: 'timestamptz' })
  validFrom: Date;

  @Column({ name: 'valid_until', type: 'timestamptz' })
  validUntil: Date;

  @Column({ name: 'reason', type: 'text' })
  reason: string;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ name: 'revoked_by', type: 'uuid', nullable: true })
  revokedBy: string | null;

  @Column({ name: 'revoke_reason', type: 'text', nullable: true })
  revokeReason: string | null;
}
