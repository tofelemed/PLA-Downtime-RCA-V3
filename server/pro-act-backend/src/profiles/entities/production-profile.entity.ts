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
import { RateTimebase } from '../../domain/actuals/actuals.types';
import {
  CAPACITY_MODELS,
  CapacityModel,
  RATE_TIMEBASES,
  VERSION_STATES,
  VersionState,
} from '../../domain/profiles/profile.types';
import { Product } from '../../product/product.entity';
import { Unit } from '../../unit/unit.entity';

/**
 * Values of the v1 master data a seeded profile came from (plan 2.2 step 3). Kept for review, never
 * used by a calculation: `capacity` has no timebase (MIG §18.2: not guessed) and `standardRate` is an
 * **unconfirmed legacy cost** until finance answers D08 Q3.
 */
export interface LegacyProfileValues {
  capacity: string | null;
  capacityUom: string | null;
  idealCycleTime: string | null;
  standardRate: string | null;
  standardRateStatus: 'unconfirmed_legacy_cost';
}

/**
 * What a unit makes of one product in one operating mode (spec §14.2 `production_profiles`, PLAN01):
 * quantity unit, default rate timebase, capacity model (D14: only `single_stream` is used until
 * `CONCURRENT_PRODUCTS`), policy references and product-mix constraints. Effective-dated versions
 * `[effective_from, effective_to)`; approved versions of one unit/product/mode never overlap
 * (exclusion constraint); a change is a new version, approved rows are only closed or retired.
 */
@Entity('production_profiles')
@Index('IDX_approval_inbox_production_profiles', { synchronize: false })
@Unique('UQ_production_profiles_key_version', [
  'tenantId',
  'unitId',
  'productId',
  'operatingMode',
  'version',
])
@Exclusion(
  'EX_production_profiles_approved_no_overlap',
  `USING gist ("unit_id" WITH =, "product_id" WITH =, "operating_mode" WITH =, ` +
    `tstzrange("effective_from", "effective_to", '[)') WITH &&) WHERE ("state" = 'approved')`,
)
@Index('IDX_production_profiles_tenant_unit_product', [
  'tenantId',
  'unitId',
  'productId',
])
@Index('IDX_production_profiles_product', ['productId'])
@Check(
  'CHK_production_profiles_effective',
  '"effective_to" IS NULL OR "effective_to" > "effective_from"',
)
@Check(
  'CHK_production_profiles_approved_at',
  `"state" <> 'approved' OR "approved_at" IS NOT NULL`,
)
export class ProductionProfile extends TenantScopedEntity {
  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @ManyToOne(() => Unit, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'unit_id' })
  unit?: Unit;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  @Column({
    name: 'operating_mode',
    type: 'varchar',
    length: 64,
    default: 'normal',
  })
  operatingMode: string;

  /** required before approval; null only on seeded drafts without a v1 unit of measure */
  @Column({ name: 'quantity_uom', type: 'varchar', length: 50, nullable: true })
  quantityUom: string | null;

  @Column({
    name: 'rate_timebase',
    type: 'enum',
    enum: RATE_TIMEBASES,
    enumName: 'production_profile_rate_timebase',
    nullable: true,
  })
  rateTimebase: RateTimebase | null;

  @Column({
    name: 'capacity_model',
    type: 'enum',
    enum: CAPACITY_MODELS,
    enumName: 'production_profile_capacity_model',
    default: 'single_stream',
  })
  capacityModel: CapacityModel;

  /** → source_authority_policies (plan 1.10); no FK until that table exists */
  @Column({ name: 'actuals_policy_id', type: 'uuid', nullable: true })
  actualsPolicyId: string | null;

  /** → policy store (0.2 `oee_policy`); no FK until that table exists */
  @Column({ name: 'oee_policy_id', type: 'uuid', nullable: true })
  oeePolicyId: string | null;

  /** → policy store (0.2 `valuation_basis`); no FK until that table exists */
  @Column({ name: 'valuation_policy_id', type: 'uuid', nullable: true })
  valuationPolicyId: string | null;

  /** joint recipe of a `shared_capacity` profile (2.3, behind CONCURRENT_PRODUCTS) */
  @Column({ name: 'product_mix_constraints', type: 'jsonb', nullable: true })
  productMixConstraints: Record<string, unknown> | null;

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
    enumName: 'production_profile_state',
    default: 'draft',
  })
  state: VersionState;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'legacy_values', type: 'jsonb', nullable: true })
  legacyValues: LegacyProfileValues | null;
}
