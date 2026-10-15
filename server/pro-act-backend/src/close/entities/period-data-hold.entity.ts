import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';

/** Why a period waits (SME R3: waiting for the lab, a failed source, or another named reason). */
export const DATA_HOLD_KINDS = ['lab', 'source', 'other'] as const;
export type DataHoldKind = (typeof DATA_HOLD_KINDS)[number];

/**
 * "Waiting for data" on a period (SME R3): an exception state with its own reason that pauses the
 * reconciliation clocks from `started_at` until it is released. At most one open hold per period; a
 * released hold is kept as history.
 */
@Entity('period_data_holds')
@Index('IDX_period_data_holds_tenant_period', ['tenantId', 'periodId'])
@Index('UQ_period_data_holds_open', ['periodId'], {
  unique: true,
  where: '"ended_at" IS NULL',
})
@Check(
  'CHK_period_data_holds_interval',
  '"ended_at" IS NULL OR "ended_at" >= "started_at"',
)
@Check('CHK_period_data_holds_kind', `"kind" IN ('lab', 'source', 'other')`)
export class PeriodDataHold extends TenantScopedEntity {
  @Column({ name: 'period_id', type: 'uuid' })
  periodId: string;

  @ManyToOne(() => ProductionPeriod, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'period_id',
    foreignKeyConstraintName: 'FK_period_data_holds_period',
  })
  period?: ProductionPeriod;

  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @Column({ name: 'kind', type: 'varchar', length: 16 })
  kind: DataHoldKind;

  @Column({ name: 'reason', type: 'text' })
  reason: string;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @Column({ name: 'started_by', type: 'uuid', nullable: true })
  startedBy: string | null;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt: Date | null;

  @Column({ name: 'ended_by', type: 'uuid', nullable: true })
  endedBy: string | null;

  @Column({ name: 'end_note', type: 'text', nullable: true })
  endNote: string | null;
}
