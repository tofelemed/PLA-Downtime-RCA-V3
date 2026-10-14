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
import { Product } from '../../product/product.entity';
import { Unit } from '../../unit/unit.entity';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';

/**
 * One entry of a unit's grade-transition matrix (LA-08, SME Q9 / E1): the approved reference duration
 * of a directional product change (from → to; B→A is its own entry) and, optionally, the reference
 * off-grade quantity it makes, with the evidence it was derived from. Effective-dated and versioned like
 * rates (maker-checker approval, supersede); approved versions of one unit and change never overlap.
 * The accounting engine splits a transition's loss into allowance (within the reference) and overrun.
 */
@Entity('transition_standards')
@Unique('UQ_transition_standards_change_version', [
  'unitId',
  'fromProductId',
  'toProductId',
  'version',
])
@Exclusion(
  'EX_transition_standards_approved_no_overlap',
  `USING gist ("unit_id" WITH =, "from_product_id" WITH =, "to_product_id" WITH =, ` +
    `tstzrange("effective_from", "effective_to", '[)') WITH &&) WHERE ("state" = 'approved')`,
)
@Index('IDX_transition_standards_tenant_unit', ['tenantId', 'unitId'])
@Index('IDX_transition_standards_from_product', ['fromProductId'])
@Index('IDX_transition_standards_to_product', ['toProductId'])
@Check(
  'CHK_transition_standards_effective',
  '"effective_to" IS NULL OR "effective_to" > "effective_from"',
)
@Check(
  'CHK_transition_standards_products',
  '"from_product_id" <> "to_product_id"',
)
@Check('CHK_transition_standards_seconds', '"reference_seconds" > 0')
@Check(
  'CHK_transition_standards_offgrade',
  '"reference_offgrade_qty" IS NULL OR ("reference_offgrade_qty" >= 0 AND "offgrade_uom" IS NOT NULL)',
)
@Check(
  'CHK_transition_standards_samples',
  '"sample_count" IS NULL OR "sample_count" > 0',
)
@Check(
  'CHK_transition_standards_approved_at',
  `"state" <> 'approved' OR "approved_at" IS NOT NULL`,
)
export class GradeTransitionStandard extends TenantScopedEntity {
  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @ManyToOne(() => Unit, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'unit_id',
    foreignKeyConstraintName: 'FK_transition_standards_unit',
  })
  unit?: Unit;

  @Column({ name: 'from_product_id', type: 'uuid' })
  fromProductId: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'from_product_id',
    foreignKeyConstraintName: 'FK_transition_standards_from_product',
  })
  fromProduct?: Product;

  @Column({ name: 'to_product_id', type: 'uuid' })
  toProductId: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'to_product_id',
    foreignKeyConstraintName: 'FK_transition_standards_to_product',
  })
  toProduct?: Product;

  /** reference duration of the transition, seconds (decimal string) */
  @Column({
    name: 'reference_seconds',
    type: 'numeric',
    precision: 14,
    scale: 3,
    transformer: decimalStringTransformer,
  })
  referenceSeconds: string;

  /** reference off-grade / wide-spec quantity per transition, in `offgrade_uom`; null = time share applies */
  @Column({
    name: 'reference_offgrade_qty',
    type: 'numeric',
    precision: 24,
    scale: 8,
    nullable: true,
    transformer: decimalStringTransformer,
  })
  referenceOffgradeQty: string | null;

  @Column({ name: 'offgrade_uom', type: 'varchar', length: 50, nullable: true })
  offgradeUom: string | null;

  /** comparable transitions the reference was derived from (SME E1) */
  @Column({ name: 'sample_count', type: 'integer', nullable: true })
  sampleCount: number | null;

  /** derivation and evidence: observations, licensor / engineering guidance, boundary definition */
  @Column({ name: 'evidence', type: 'text', nullable: true })
  evidence: string | null;

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
    enumName: 'transition_standard_state',
    default: 'draft',
  })
  state: VersionState;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;
}
