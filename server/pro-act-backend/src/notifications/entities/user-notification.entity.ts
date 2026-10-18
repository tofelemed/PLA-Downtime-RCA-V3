import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { NotificationResolution } from '../../domain/notifications/work-item-key';
import { User } from '../../users/user.entity';

/**
 * `sla_reminder`: SME R3 due reminder of the preparer / checker; `sla_escalation`: R3 / R6 escalation;
 * item 6: due / overdue RCA actions and tasks, uncoded stop backlog of a unit and day, long open stops.
 */
export const NOTIFICATION_KINDS = [
  'sla_reminder',
  'sla_escalation',
  'source_fallback',
  'rca_action_due',
  'rca_action_overdue',
  'task_due',
  'task_overdue',
  'uncoded_backlog',
  'long_open_stop',
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/**
 * An in-app notification of one user in one plant (EXPERT_REVIEW Area 3, SME R3 / R6 escalations): what
 * happened (`kind`, the record it concerns and a structured `detail` the client renders in plant time) and
 * whether the user read it. `dedupe_key` makes the producer idempotent — one notification per user and
 * key (e.g. one per period and escalation level). Copies of one shared work item share `work_item_key` and
 * are resolved together once anyone does the work (`resolved_at`, owner 18 Oct). No e-mail or SMS.
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
  where: `"read_at" IS NULL AND "resolved_at" IS NULL`,
})
@Index(
  'IDX_user_notifications_user_active',
  ['tenantId', 'userId', 'createdAt', 'id'],
  { where: `"resolved_at" IS NULL` },
)
@Index('IDX_user_notifications_open_work', ['tenantId', 'kind'], {
  where: `"resolved_at" IS NULL AND "work_item_key" IS NOT NULL`,
})
@Check(
  'CHK_user_notifications_resolution',
  `("resolved_at" IS NULL AND "resolution" IS NULL) OR ("resolved_at" IS NOT NULL AND "resolution" IN ('completed', 'superseded'))`,
)
@Index('IDX_user_notifications_user', ['userId'])
@Check(
  'CHK_user_notifications_kind',
  `"kind" IN ('sla_reminder', 'sla_escalation', 'source_fallback', 'rca_action_due', 'rca_action_overdue', 'task_due', 'task_overdue', 'uncoded_backlog', 'long_open_stop')`,
)
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

  /** the shared work item (`workItemKeyOf`); null for information-only notifications */
  @Column({
    name: 'work_item_key',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  workItemKey: string | null;

  /** when the work item was done by anyone (the notification leaves every recipient's active list) */
  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolution', type: 'varchar', length: 32, nullable: true })
  resolution: NotificationResolution | null;
}
