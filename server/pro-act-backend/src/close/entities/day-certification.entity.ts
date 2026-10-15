import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { Unit } from '../../unit/unit.entity';

/** The approved revisions a certification covers. */
export interface CertifiedRevisionRef {
  periodId: string;
  revisionId: string;
  revision: number;
}

/**
 * One approval of a production day of a unit (owner decision 14 Oct 2026: day certification, SME R2): it
 * certifies the roll-up of the day's approved shift revisions it lists (the quantities stay on the shifts;
 * `rollup_hash` fixes what was certified). A revise of one of those shifts — the correction path — reopens
 * it; a new certification is a new row. At most one certified row per unit and date.
 */
@Entity('production_day_certifications')
@Index('UQ_production_day_certifications_certified', ['unitId', 'localDate'], {
  unique: true,
  where: `"state" = 'certified'`,
})
@Index('IDX_production_day_certifications_unit_date', ['unitId', 'localDate'])
@Index('IDX_production_day_certifications_tenant_date', [
  'tenantId',
  'localDate',
])
@Check(
  'CHK_production_day_certifications_state',
  `"state" IN ('certified', 'reopened')`,
)
export class DayCertification extends TenantScopedEntity {
  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @ManyToOne(() => Unit, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'unit_id',
    foreignKeyConstraintName: 'FK_production_day_certifications_unit',
  })
  unit?: Unit;

  @Column({ name: 'local_date', type: 'date' })
  localDate: string;

  @Column({ name: 'state', type: 'varchar', length: 16, default: 'certified' })
  state: 'certified' | 'reopened';

  @Column({ name: 'revisions', type: 'jsonb' })
  revisions: CertifiedRevisionRef[];

  @Column({ name: 'rollup_hash', type: 'varchar', length: 64 })
  rollupHash: string;

  @Column({ name: 'certified_by', type: 'uuid' })
  certifiedBy: string;

  @Column({ name: 'certified_at', type: 'timestamptz' })
  certifiedAt: Date;

  @Column({ name: 'comment', type: 'text', nullable: true })
  comment: string | null;

  @Column({ name: 'reopened_by', type: 'uuid', nullable: true })
  reopenedBy: string | null;

  @Column({ name: 'reopened_at', type: 'timestamptz', nullable: true })
  reopenedAt: Date | null;

  @Column({ name: 'reopen_reason', type: 'text', nullable: true })
  reopenReason: string | null;
}
