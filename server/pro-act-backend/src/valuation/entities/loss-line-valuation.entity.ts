import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { CalculationRun } from '../../accounting/entities/calculation-run.entity';
import { LossLine } from '../../accounting/entities/loss-line.entity';
import { TenantOwnedEntity } from '../../common/entities/tenant-scoped.entity';
import { Ledger, LEDGERS } from '../../domain/accounting/accounting.types';
import {
  VALUATION_VIEWS,
  ValuationView,
} from '../../domain/valuation/valuation.types';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';

export const LINE_VALUATION_STATUSES = ['valued', 'unvalued'] as const;
export type LineValuationStatus = (typeof LINE_VALUATION_STATUSES)[number];

/**
 * Normalized copy of `loss_lines.valuation` for querying (plan 2.6): one row per line, view and reporting
 * currency with the amount (null = unvalued or no approved FX rate, never zero), the rate and FX versions
 * and the valuation date. Written with the run, immutable.
 */
@Entity('loss_line_valuations')
@Unique('UQ_loss_line_valuations_line_view_currency', [
  'lossLineId',
  'view',
  'currency',
])
@Index('IDX_loss_line_valuations_tenant_run', ['tenantId', 'runId'])
@Index('IDX_loss_line_valuations_period', ['periodId'])
@Index('IDX_loss_line_valuations_run', ['runId'])
export class LossLineValuation extends TenantOwnedEntity {
  @Column({ name: 'run_id', type: 'uuid' })
  runId: string;

  @ManyToOne(() => CalculationRun, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'run_id',
    foreignKeyConstraintName: 'FK_loss_line_valuations_run',
  })
  run?: CalculationRun;

  @Column({ name: 'loss_line_id', type: 'uuid' })
  lossLineId: string;

  @ManyToOne(() => LossLine, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'loss_line_id',
    foreignKeyConstraintName: 'FK_loss_line_valuations_line',
  })
  lossLine?: LossLine;

  @Column({ name: 'period_id', type: 'uuid' })
  periodId: string;

  @Column({ name: 'slice_id', type: 'uuid' })
  sliceId: string;

  @Column({
    name: 'ledger',
    type: 'enum',
    enum: LEDGERS,
    enumName: 'loss_ledger',
  })
  ledger: Ledger;

  @Column({
    name: 'view',
    type: 'enum',
    enum: VALUATION_VIEWS,
    enumName: 'valuation_view',
  })
  view: ValuationView;

  @Column({ name: 'currency', type: 'varchar', length: 3 })
  currency: string;

  @Column({
    name: 'amount',
    type: 'numeric',
    precision: 28,
    scale: 8,
    nullable: true,
    transformer: decimalStringTransformer,
  })
  amount: string | null;

  /** every component was priced in this currency (no conversion) */
  @Column({ name: 'native', type: 'boolean' })
  native: boolean;

  @Column({
    name: 'status',
    type: 'enum',
    enum: LINE_VALUATION_STATUSES,
    enumName: 'line_valuation_status',
  })
  status: LineValuationStatus;

  @Column({ name: 'reason', type: 'varchar', length: 64, nullable: true })
  reason: string | null;

  /** SME V7: the amount was converted with an authorised provisional FX rate */
  @Column({ name: 'provisional', type: 'boolean', default: false })
  provisional: boolean;

  @Column({ name: 'rate_version_ids', type: 'jsonb', default: () => "'[]'" })
  rateVersionIds: string[];

  @Column({ name: 'fx_rate_ids', type: 'jsonb', default: () => "'[]'" })
  fxRateIds: string[];

  @Column({ name: 'valuation_date', type: 'timestamptz' })
  valuationDate: Date;
}
