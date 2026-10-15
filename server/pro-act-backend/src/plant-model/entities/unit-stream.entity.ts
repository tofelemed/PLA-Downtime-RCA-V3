import {
  Check,
  Column,
  Entity,
  Exclusion,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import {
  VERSION_STATES,
  VersionState,
} from '../../domain/profiles/profile.types';
import { Unit } from '../../unit/unit.entity';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';

/**
 * A stream of a unit (SME E6 / LA-10): a parallel train or line with the share of the unit's rate it
 * provides. Effective-dated, versioned per unit and code like rates (maker-checker approval, supersede;
 * approved versions of one stream never overlap). Products run on streams (`stream_runs`); a slice's
 * capacity is its streams' share over the time they ran its product.
 */
@Entity('unit_streams')
@Unique('UQ_unit_streams_code_version', ['unitId', 'code', 'version'])
@Exclusion(
  'EX_unit_streams_approved_no_overlap',
  `USING gist ("unit_id" WITH =, "code" WITH =, tstzrange("effective_from", "effective_to", '[)') WITH &&) ` +
    `WHERE ("state" = 'approved')`,
)
@Index('IDX_unit_streams_tenant_unit', ['tenantId', 'unitId'])
@Check(
  'CHK_unit_streams_share',
  '"capacity_share" > 0 AND "capacity_share" <= 1',
)
@Check('CHK_unit_streams_code', `"code" <> ''`)
@Check(
  'CHK_unit_streams_effective',
  '"effective_to" IS NULL OR "effective_to" > "effective_from"',
)
@Check(
  'CHK_unit_streams_approved_at',
  `"state" <> 'approved' OR "approved_at" IS NOT NULL`,
)
export class UnitStream extends TenantScopedEntity {
  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @ManyToOne(() => Unit, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'unit_id',
    foreignKeyConstraintName: 'FK_unit_streams_unit',
  })
  unit?: Unit;

  /** stable stream identity within the unit (runs and events name it) */
  @Column({ name: 'code', type: 'varchar', length: 64 })
  code: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name: string;

  /** share of the unit's rate the stream provides, (0, 1] (decimal string) */
  @Column({
    name: 'capacity_share',
    type: 'numeric',
    precision: 9,
    scale: 8,
    transformer: decimalStringTransformer,
  })
  capacityShare: string;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'effective_from', type: 'timestamptz' })
  effectiveFrom: Date;

  @Column({ name: 'effective_to', type: 'timestamptz', nullable: true })
  effectiveTo: Date | null;

  @Column({ name: 'version', type: 'int' })
  version: number;

  @Column({
    name: 'state',
    type: 'enum',
    enum: VERSION_STATES,
    enumName: 'unit_stream_state',
    default: 'draft',
  })
  state: VersionState;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;
}
