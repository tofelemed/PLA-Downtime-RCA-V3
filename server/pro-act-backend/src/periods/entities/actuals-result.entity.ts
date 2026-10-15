import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantOwnedEntity } from '../../common/entities/tenant-scoped.entity';
import {
  ACTUALS_METHODS,
  ActualsMethod,
  PeriodFinding,
  QUALITY_STATES,
  QualityState,
  SliceActuals,
  SourceSegment,
  SourceSubstitution,
} from '../../domain/actuals/period/period-actuals.types';
import { QualityClasses } from '../../domain/actuals/period/quality-classes';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';
import { ActualsRun } from './actuals-run.entity';
import { PeriodProductSlice } from './period-product-slice.entity';

const quantity = (name: string) => ({
  name,
  type: 'numeric' as const,
  precision: 24,
  scale: 8,
  nullable: true,
  transformer: decimalStringTransformer,
});

/**
 * Authoritative actuals of one slice in one run (spec §14.2 `actuals_results`, ACT01, ACT05, ACT07):
 * gross / good / reject / accepted rework (null = unknown, never zero), quantity unit and basis, method,
 * coverage ratio with measured and estimated quantity, quality state, provenance segments and findings.
 * Rows are immutable (trigger `actuals_results_immutable`).
 */
@Entity('actuals_results')
@Index('IDX_actuals_results_run', ['actualsRunId'])
@Index('IDX_actuals_results_slice', ['sliceId'])
@Index('IDX_actuals_results_tenant_period', ['tenantId', 'periodId'])
export class ActualsResult extends TenantOwnedEntity {
  @Column({ name: 'actuals_run_id', type: 'uuid' })
  actualsRunId: string;

  @ManyToOne(() => ActualsRun, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'actuals_run_id',
    foreignKeyConstraintName: 'FK_actuals_results_run',
  })
  run?: ActualsRun;

  @Column({ name: 'period_id', type: 'uuid' })
  periodId: string;

  @Column({ name: 'slice_id', type: 'uuid' })
  sliceId: string;

  @ManyToOne(() => PeriodProductSlice, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'slice_id',
    foreignKeyConstraintName: 'FK_actuals_results_slice',
  })
  slice?: PeriodProductSlice;

  @Column(quantity('gross'))
  gross: string | null;

  @Column(quantity('good'))
  good: string | null;

  @Column(quantity('reject'))
  reject: string | null;

  @Column(quantity('rework_accepted'))
  reworkAccepted: string | null;

  @Column({ name: 'uom', type: 'varchar', length: 50, nullable: true })
  uom: string | null;

  @Column({ name: 'basis', type: 'varchar', length: 8 })
  basis: SliceActuals['basis'];

  @Column({
    name: 'method',
    type: 'enum',
    enum: ACTUALS_METHODS,
    enumName: 'actuals_result_method',
    nullable: true,
  })
  method: ActualsMethod | null;

  @Column({
    name: 'coverage_ratio',
    type: 'numeric',
    precision: 9,
    scale: 8,
    nullable: true,
    transformer: decimalStringTransformer,
  })
  coverageRatio: string | null;

  @Column(quantity('measured_qty'))
  measuredQty: string | null;

  @Column(quantity('estimated_qty'))
  estimatedQty: string | null;

  @Column({
    name: 'quality_state',
    type: 'enum',
    enum: QUALITY_STATES,
    enumName: 'actuals_result_quality',
  })
  qualityState: QualityState;

  @Column({ name: 'source_segments', type: 'jsonb' })
  sourceSegments: SourceSegment[];

  @Column({ name: 'exceptions', type: 'jsonb' })
  exceptions: PeriodFinding[];

  @Column({ name: 'coverage', type: 'jsonb' })
  coverage: SliceActuals['coverage'];

  @Column({ name: 'adjustment_ids', type: 'jsonb' })
  adjustmentIds: string[];

  /** SME E3: disposition class breakdown (actuals 2.4.2); null = no disposition / rework in the slice */
  @Column({ name: 'quality_classes', type: 'jsonb', nullable: true })
  qualityClasses: QualityClasses | null;

  /** SME E7: lower-ranked source or approved estimate used (actuals 2.4.3); null = top rank or older run */
  @Column({ name: 'substitution', type: 'jsonb', nullable: true })
  substitution: SourceSubstitution | null;

  @Column({ name: 'computed_at', type: 'timestamptz' })
  computedAt: Date;
}
