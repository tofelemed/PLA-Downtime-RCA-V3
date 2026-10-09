import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { PlanPeriod } from '../../plans/entities/plan-period.entity';
import { Product } from '../../product/product.entity';
import { ProductionProfile } from '../../profiles/entities/production-profile.entity';
import { AccountingPolicy } from './accounting-policy.entity';
import { ProductionPeriod } from './production-period.entity';

export const SLICE_SOURCES = ['plan', 'profile_default'] as const;
export type SliceSource = (typeof SLICE_SOURCES)[number];

/**
 * A product slice of a production period (spec §14.2 `period_product_slices`, §3.1): the product, the
 * profile and accounting-baseline plan period it came from, its window inside the period (a campaign
 * boundary splits the period; concurrent products are separate slices of the same window) and the
 * actuals policy in force. A re-resolution (new baseline plan) retires slices (`superseded_at`) instead
 * of deleting them, because actuals results keep pointing at the slice they were computed for.
 */
@Entity('period_product_slices')
@Index(
  'UQ_period_product_slices_active',
  ['periodId', 'productId', 'windowFrom'],
  { unique: true, where: '"superseded_at" IS NULL' },
)
@Index('IDX_period_product_slices_period', ['periodId'])
@Index('IDX_period_product_slices_product', ['productId'])
@Index('IDX_period_product_slices_profile', ['profileId'])
@Index('IDX_period_product_slices_plan_period', ['planPeriodId'])
@Index('IDX_period_product_slices_policy', ['actualsPolicyId'])
@Check('CHK_period_product_slices_window', '"window_to" > "window_from"')
export class PeriodProductSlice extends TenantScopedEntity {
  @Column({ name: 'period_id', type: 'uuid' })
  periodId: string;

  @ManyToOne(() => ProductionPeriod, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'period_id',
    foreignKeyConstraintName: 'FK_period_product_slices_period',
  })
  period?: ProductionPeriod;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'product_id',
    foreignKeyConstraintName: 'FK_period_product_slices_product',
  })
  product?: Product;

  @Column({ name: 'profile_id', type: 'uuid', nullable: true })
  profileId: string | null;

  @ManyToOne(() => ProductionProfile, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'profile_id',
    foreignKeyConstraintName: 'FK_period_product_slices_profile',
  })
  profile?: ProductionProfile | null;

  @Column({ name: 'plan_period_id', type: 'uuid', nullable: true })
  planPeriodId: string | null;

  @ManyToOne(() => PlanPeriod, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'plan_period_id',
    foreignKeyConstraintName: 'FK_period_product_slices_plan_period',
  })
  planPeriod?: PlanPeriod | null;

  @Column({
    name: 'source',
    type: 'enum',
    enum: SLICE_SOURCES,
    enumName: 'period_product_slice_source',
  })
  source: SliceSource;

  /** the slice's part of the period, `[from, to)` */
  @Column({ name: 'window_from', type: 'timestamptz' })
  windowFrom: Date;

  @Column({ name: 'window_to', type: 'timestamptz' })
  windowTo: Date;

  @Column({ name: 'campaign_from', type: 'timestamptz', nullable: true })
  campaignFrom: Date | null;

  @Column({ name: 'campaign_to', type: 'timestamptz', nullable: true })
  campaignTo: Date | null;

  /** profile quantity unit; actuals are never converted */
  @Column({ name: 'quantity_uom', type: 'varchar', length: 50, nullable: true })
  quantityUom: string | null;

  @Column({ name: 'actuals_policy_id', type: 'uuid', nullable: true })
  actualsPolicyId: string | null;

  @ManyToOne(() => AccountingPolicy, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'actuals_policy_id',
    foreignKeyConstraintName: 'FK_period_product_slices_policy',
  })
  actualsPolicy?: AccountingPolicy | null;

  @Column({ name: 'superseded_at', type: 'timestamptz', nullable: true })
  supersededAt: Date | null;
}
