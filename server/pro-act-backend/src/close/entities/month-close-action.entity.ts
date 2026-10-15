import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { MonthClose } from './month-close.entity';

/**
 * One step of a month close (SME R1 / R4): who, when, the state before and after, the reason or comment and
 * the evidence the step saw (prerequisite counts, materiality findings). Append-only (trigger).
 */
@Entity('month_close_actions')
@Index('IDX_month_close_actions_close', ['monthCloseId', 'createdAt'])
export class MonthCloseAction extends TenantScopedEntity {
  @Column({ name: 'month_close_id', type: 'uuid' })
  monthCloseId: string;

  @ManyToOne(() => MonthClose, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'month_close_id',
    foreignKeyConstraintName: 'FK_month_close_actions_close',
  })
  monthClose?: MonthClose;

  @Column({ name: 'action', type: 'varchar', length: 32 })
  action: string;

  @Column({ name: 'from_state', type: 'varchar', length: 24 })
  fromState: string;

  @Column({ name: 'to_state', type: 'varchar', length: 24 })
  toState: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'detail', type: 'jsonb', default: () => "'{}'" })
  detail: Record<string, unknown>;
}
