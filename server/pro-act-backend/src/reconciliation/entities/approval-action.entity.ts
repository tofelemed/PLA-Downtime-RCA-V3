import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AccountingRevision } from '../../accounting/entities/accounting-revision.entity';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';

export const APPROVAL_ACTION_KINDS = [
  'save_draft',
  'submit',
  'approve',
  'reject',
  'revise',
  'cancel',
  'recompute',
  'stale',
  /** SME R8: second independent review of bridges above the unit limit (in_review → in_review) */
  'bridge_review',
] as const;
export type ApprovalActionKind = (typeof APPROVAL_ACTION_KINDS)[number];

/**
 * One workflow step of an accounting revision (spec §14.2 `approval_actions`, WF01/WF02): who (a user, or
 * a named service for stale marking), when, the lifecycle before and after, the reason or comment, the
 * submitted hash and the request correlation id. Append-only (trigger).
 */
@Entity('approval_actions')
@Index('IDX_approval_actions_revision', ['revisionId'])
@Index('IDX_approval_actions_tenant_period_created', [
  'tenantId',
  'periodId',
  'createdAt',
])
export class ApprovalAction extends TenantScopedEntity {
  @Column({ name: 'revision_id', type: 'uuid' })
  revisionId: string;

  @ManyToOne(() => AccountingRevision, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'revision_id',
    foreignKeyConstraintName: 'FK_approval_actions_revision',
  })
  revision?: AccountingRevision;

  @Column({ name: 'period_id', type: 'uuid' })
  periodId: string;

  @Column({
    name: 'action',
    type: 'enum',
    enum: APPROVAL_ACTION_KINDS,
    enumName: 'approval_action_kind',
  })
  action: ApprovalActionKind;

  @Column({ name: 'from_lifecycle', type: 'varchar', length: 16 })
  fromLifecycle: string;

  @Column({ name: 'to_lifecycle', type: 'varchar', length: 16 })
  toLifecycle: string;

  /** null when a service acted (see `service`) */
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ name: 'service', type: 'varchar', length: 64, nullable: true })
  service: string | null;

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason: string | null;

  @Column({
    name: 'submitted_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  submittedHash: string | null;

  /** SME R6: what a rejection names — failed lines, the new due time, the rejection count */
  @Column({ name: 'detail', type: 'jsonb', default: () => "'{}'" })
  detail: Record<string, unknown>;

  @Column({
    name: 'correlation_id',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  correlationId: string | null;
}
