import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';
import { PeriodProductSlice } from './period-product-slice.entity';

export const ADJUSTMENT_KINDS = ['gross', 'good', 'reject', 'rework'] as const;
export const ADJUSTMENT_BASES = ['measured', 'estimated'] as const;
export const ADJUSTMENT_STATES = ['proposed', 'approved', 'rejected'] as const;
export type AdjustmentState = (typeof ADJUSTMENT_STATES)[number];

/**
 * A governed manual actuals correction (spec §14.2 `actuals_adjustments`, ACT06): slice, component,
 * signed quantity in the slice unit, basis (measured or estimated), reason, evidence, measurement window
 * and author; approved or rejected by someone else (CHECK). Raw evidence stays immutable: an approved
 * adjustment is a separate component of a new actuals result, never an edit of a stored quantity.
 */
@Entity('actuals_adjustments')
@Index('IDX_actuals_adjustments_slice', ['sliceId'])
@Index('IDX_actuals_adjustments_tenant_period', ['tenantId', 'periodId'])
@Index('IDX_actuals_adjustments_tenant_unit', ['tenantId', 'unitId'])
@Check(
  'CHK_actuals_adjustments_independent',
  '"decided_by" IS NULL OR "decided_by" <> "author_id"',
)
@Check(
  'CHK_actuals_adjustments_window',
  '("window_from" IS NULL) = ("window_to" IS NULL) AND ("window_from" IS NULL OR "window_to" > "window_from")',
)
export class ActualsAdjustment extends TenantScopedEntity {
  @Column({ name: 'slice_id', type: 'uuid' })
  sliceId: string;

  @ManyToOne(() => PeriodProductSlice, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'slice_id',
    foreignKeyConstraintName: 'FK_actuals_adjustments_slice',
  })
  slice?: PeriodProductSlice;

  /** copies of the slice's period and unit (scope filters) */
  @Column({ name: 'period_id', type: 'uuid' })
  periodId: string;

  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @Column({
    name: 'kind',
    type: 'enum',
    enum: ADJUSTMENT_KINDS,
    enumName: 'actuals_adjustment_kind',
  })
  kind: (typeof ADJUSTMENT_KINDS)[number];

  @Column({
    name: 'quantity',
    type: 'numeric',
    precision: 24,
    scale: 8,
    transformer: decimalStringTransformer,
  })
  quantity: string;

  @Column({ name: 'uom', type: 'varchar', length: 50, nullable: true })
  uom: string | null;

  @Column({
    name: 'basis',
    type: 'enum',
    enum: ADJUSTMENT_BASES,
    enumName: 'actuals_adjustment_basis',
  })
  basis: (typeof ADJUSTMENT_BASES)[number];

  @Column({ name: 'reason', type: 'text' })
  reason: string;

  @Column({ name: 'evidence_ref', type: 'text' })
  evidenceRef: string;

  @Column({ name: 'window_from', type: 'timestamptz', nullable: true })
  windowFrom: Date | null;

  @Column({ name: 'window_to', type: 'timestamptz', nullable: true })
  windowTo: Date | null;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @Column({
    name: 'state',
    type: 'enum',
    enum: ADJUSTMENT_STATES,
    enumName: 'actuals_adjustment_state',
    default: 'proposed',
  })
  state: AdjustmentState;

  @Column({ name: 'decided_by', type: 'uuid', nullable: true })
  decidedBy: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({ name: 'decision_reason', type: 'text', nullable: true })
  decisionReason: string | null;
}
