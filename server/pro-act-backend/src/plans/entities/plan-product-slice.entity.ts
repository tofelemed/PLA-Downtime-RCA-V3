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
import { SLICE_STREAMS, SliceStream } from '../../domain/plans/plan.types';
import { Product } from '../../product/product.entity';
import { ProductionProfile } from '../../profiles/entities/production-profile.entity';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';
import { PlanVersion } from './plan-version.entity';

/**
 * A product slice of a plan version (spec §14.2 `plan_product_slices`, PLAN02/PLAN05): the product, an
 * optional profile pin (its operating mode is used; default `normal`), the campaign `[from, to)` inside the
 * version window (null = whole window), a weight (explicit_weights), an own target (per-slice quantity
 * plans, required when quantity units differ) and the stream kind (D14). `scenario_id`, `unit_id`,
 * `active_from/to` and `is_approved` are copies kept for the PLAN04 exclusion constraint: approved slices
 * of one scenario, unit and product never overlap in time.
 */
@Entity('plan_product_slices')
@Unique('UQ_plan_product_slices_version_position', [
  'planVersionId',
  'position',
])
@Exclusion(
  'EX_plan_product_slices_approved_no_overlap',
  `USING gist ("scenario_id" WITH =, "unit_id" WITH =, "product_id" WITH =, ` +
    `tstzrange("active_from", "active_to", '[)') WITH &&) WHERE ("is_approved")`,
)
@Index('IDX_plan_product_slices_product', ['productId'])
@Index('IDX_plan_product_slices_profile', ['profileId'])
@Index('IDX_plan_product_slices_scenario_unit', ['scenarioId', 'unitId'])
@Check('CHK_plan_product_slices_active', '"active_to" > "active_from"')
@Check(
  'CHK_plan_product_slices_campaign',
  '"campaign_from" IS NULL OR "campaign_to" IS NULL OR "campaign_to" > "campaign_from"',
)
export class PlanProductSlice extends TenantScopedEntity {
  @Column({ name: 'plan_version_id', type: 'uuid' })
  planVersionId: string;

  @ManyToOne(() => PlanVersion, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'plan_version_id',
    foreignKeyConstraintName: 'FK_plan_product_slices_version',
  })
  planVersion?: PlanVersion;

  /** 0-based order; the last slice takes rounding remainders across slices */
  @Column({ name: 'position', type: 'int' })
  position: number;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'product_id',
    foreignKeyConstraintName: 'FK_plan_product_slices_product',
  })
  product?: Product;

  @Column({ name: 'profile_id', type: 'uuid', nullable: true })
  profileId: string | null;

  @ManyToOne(() => ProductionProfile, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'profile_id',
    foreignKeyConstraintName: 'FK_plan_product_slices_profile',
  })
  profile?: ProductionProfile | null;

  @Column({ name: 'campaign_from', type: 'timestamptz', nullable: true })
  campaignFrom: Date | null;

  @Column({ name: 'campaign_to', type: 'timestamptz', nullable: true })
  campaignTo: Date | null;

  @Column({
    name: 'weight',
    type: 'numeric',
    precision: 12,
    scale: 8,
    nullable: true,
    transformer: decimalStringTransformer,
  })
  weight: string | null;

  @Column({
    name: 'target',
    type: 'numeric',
    precision: 24,
    scale: 8,
    nullable: true,
    transformer: decimalStringTransformer,
  })
  target: string | null;

  @Column({
    name: 'stream',
    type: 'enum',
    enum: SLICE_STREAMS,
    enumName: 'plan_product_slice_stream',
    default: 'sequential',
  })
  stream: SliceStream;

  @Column({ name: 'scenario_id', type: 'uuid' })
  scenarioId: string;

  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  /** campaign ∩ version window */
  @Column({ name: 'active_from', type: 'timestamptz' })
  activeFrom: Date;

  @Column({ name: 'active_to', type: 'timestamptz' })
  activeTo: Date;

  @Column({ name: 'is_approved', type: 'boolean', default: false })
  isApproved: boolean;
}
