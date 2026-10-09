import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { Ledger, LEDGERS } from '../../domain/accounting/accounting.types';
import { PeriodProductSlice } from '../../periods/entities/period-product-slice.entity';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';
import { CalculationRun } from './calculation-run.entity';

const quantity = (name: string) => ({
  name,
  type: 'numeric' as const,
  precision: 24,
  scale: 8,
  nullable: true,
  transformer: decimalStringTransformer,
});

/**
 * Totals of one slice and ledger in a run (plan 2.5 `period_ledger_totals`, materialized with the run):
 * capacity identity (capacity, exclusion, A, P, Q, good, gain, residual) and plan identity (target,
 * actual, gap, attributed, residual, overproduction, over-accounted) with state flags. null = not
 * computable (no profile, no plan, actuals missing), never zero. Immutable.
 */
@Entity('period_ledger_totals')
@Unique('UQ_period_ledger_totals_run_slice_ledger', [
  'runId',
  'sliceId',
  'ledger',
])
@Index('IDX_period_ledger_totals_slice', ['sliceId'])
@Index('IDX_period_ledger_totals_tenant_period', ['tenantId', 'periodId'])
export class PeriodLedgerTotal extends TenantScopedEntity {
  @Column({ name: 'run_id', type: 'uuid' })
  runId: string;

  @ManyToOne(() => CalculationRun, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'run_id',
    foreignKeyConstraintName: 'FK_period_ledger_totals_run',
  })
  run?: CalculationRun;

  @Column({ name: 'period_id', type: 'uuid' })
  periodId: string;

  @Column({ name: 'slice_id', type: 'uuid' })
  sliceId: string;

  @ManyToOne(() => PeriodProductSlice, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'slice_id',
    foreignKeyConstraintName: 'FK_period_ledger_totals_slice',
  })
  slice?: PeriodProductSlice;

  @Column({
    name: 'ledger',
    type: 'enum',
    enum: LEDGERS,
    enumName: 'loss_ledger',
  })
  ledger: Ledger;

  @Column({ name: 'uom', type: 'varchar', length: 50, nullable: true })
  uom: string | null;

  @Column(quantity('capacity_qty'))
  capacityQty: string | null;

  @Column(quantity('exclusion_qty'))
  exclusionQty: string | null;

  @Column(quantity('availability_qty'))
  availabilityQty: string | null;

  @Column(quantity('performance_qty'))
  performanceQty: string | null;

  @Column(quantity('quality_qty'))
  qualityQty: string | null;

  @Column(quantity('good_qty'))
  goodQty: string | null;

  @Column(quantity('gain_qty'))
  gainQty: string | null;

  @Column(quantity('attributed_qty'))
  attributedQty: string | null;

  @Column(quantity('residual_qty'))
  residualQty: string | null;

  @Column(quantity('target_qty'))
  targetQty: string | null;

  @Column(quantity('actual_qty'))
  actualQty: string | null;

  @Column(quantity('gap_qty'))
  gapQty: string | null;

  @Column(quantity('overproduction_qty'))
  overproductionQty: string | null;

  @Column(quantity('over_accounted_qty'))
  overAccountedQty: string | null;

  @Column({ name: 'flags', type: 'jsonb', default: () => "'[]'" })
  flags: string[];
}
