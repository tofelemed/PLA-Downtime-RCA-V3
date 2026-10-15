import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { User } from '../../users/user.entity';

export const NOTIFICATION_KINDS = ['sla_escalation'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/**
 * An in-app notification of one user in one plant (EXPERT_REVIEW Area 3, SME R3 / R6 escalations): what
 * happened (`kind`, the record it concerns and a structured `detail` the client renders in plant time) and
 * whether the user read it. `dedupe_key` makes the producer idempotent — one notification per user and
 * key (e.g. one per period and escalation level). No e-mail or SMS.
 */
@Entity('user_notifications')
@Index('UQ_user_notifications_user_key', ['tenantId', 'userId', 'dedupeKey'], {
  unique: true,
})
@Index('IDX_user_notifications_user_created', [
  'tenantId',
  'userId',
  'createdAt',
  'id',
])
@Index('IDX_user_notifications_user_unread', ['tenantId', 'userId'], {
  where: `"read_at" IS NULL`,
})
@Index('IDX_user_notifications_user', ['userId'])
@Check('CHK_user_notifications_kind', `"kind" IN ('sla_escalation')`)
export class UserNotification extends TenantScopedEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_user_notifications_user',
  })
  user?: User;

  @Column({ name: 'kind', type: 'varchar', length: 32 })
  kind: NotificationKind;

  @Column({ name: 'dedupe_key', type: 'varchar', length: 200 })
  dedupeKey: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 64 })
  entityType: string;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId: string;

  @Column({ name: 'detail', type: 'jsonb', default: () => "'{}'" })
  detail: Record<string, unknown>;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;
}
