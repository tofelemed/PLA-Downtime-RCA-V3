import { Index } from 'typeorm';
import { Check, Column, Entity, Unique } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { MonthCloseState } from '../../domain/close/month-close-machine';

/**
 * The close of one financial month of a plant (SME R1 / R4): its operational dates `[first_date,
 * end_date)` in the month's calendar, the state, both sign-offs (plant management closes quantities,
 * finance signs off — never the same person), the optional materiality review and the lock. Created by
 * the first command on the month; a month without a row is open. The `month_close` policy version it
 * was first acted on under is kept, so its deadlines do not move with a later policy version.
 */
@Entity('month_closes')
@Index('IDX_approval_inbox_month_closes', { synchronize: false })
@Unique('UQ_month_closes_tenant_first_date', ['tenantId', 'firstDate'])
@Check('CHK_month_closes_dates', '"end_date" > "first_date"')
@Check(
  'CHK_month_closes_state',
  `"state" IN ('open', 'quantities_closed', 'finance_signed_off', 'locked')`,
)
export class MonthClose extends TenantScopedEntity {
  @Column({ name: 'calendar', type: 'varchar', length: 16 })
  calendar: string;

  @Column({ name: 'month_key', type: 'varchar', length: 7 })
  monthKey: string;

  @Column({ name: 'first_date', type: 'date' })
  firstDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ name: 'state', type: 'varchar', length: 24, default: 'open' })
  state: MonthCloseState;

  @Column({ name: 'policy_id', type: 'uuid' })
  policyId: string;

  @Column({ name: 'policy_version', type: 'int' })
  policyVersion: number;

  @Column({ name: 'quantities_closed_by', type: 'uuid', nullable: true })
  quantitiesClosedBy: string | null;

  @Column({
    name: 'quantities_closed_at',
    type: 'timestamptz',
    nullable: true,
  })
  quantitiesClosedAt: Date | null;

  @Column({ name: 'finance_signed_off_by', type: 'uuid', nullable: true })
  financeSignedOffBy: string | null;

  @Column({
    name: 'finance_signed_off_at',
    type: 'timestamptz',
    nullable: true,
  })
  financeSignedOffAt: Date | null;

  /** materiality findings at the quantity close made the extra review required (SME R1) */
  @Column({ name: 'materiality_required', type: 'boolean', default: false })
  materialityRequired: boolean;

  @Column({ name: 'materiality_reviewed_by', type: 'uuid', nullable: true })
  materialityReviewedBy: string | null;

  @Column({
    name: 'materiality_reviewed_at',
    type: 'timestamptz',
    nullable: true,
  })
  materialityReviewedAt: Date | null;

  @Column({ name: 'locked_by', type: 'uuid', nullable: true })
  lockedBy: string | null;

  @Column({ name: 'locked_at', type: 'timestamptz', nullable: true })
  lockedAt: Date | null;

  @Column({ name: 'reopen_count', type: 'int', default: 0 })
  reopenCount: number;

  /** latest sign-off comment or reopen reason */
  @Column({ name: 'comment', type: 'text', nullable: true })
  comment: string | null;
}
