import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { CalculationRun } from '../../accounting/entities/calculation-run.entity';
import { TenantOwnedEntity } from '../../common/entities/tenant-scoped.entity';
import {
  Ledger,
  LEDGERS,
  LOSS_KINDS,
  LossKind,
} from '../../domain/accounting/accounting.types';
import {
  INDEPENDENT_VIEW,
  TotalsView,
  VALUATION_VIEWS,
} from '../../domain/valuation/valuation.types';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';

export const TOTALS_VIEWS = [...VALUATION_VIEWS, INDEPENDENT_VIEW] as const;

const money = (name: string, nullable: boolean) => ({
  name,
  type: 'numeric' as const,
  precision: 28,
  scale: 8,
  nullable,
  transformer: decimalStringTransformer,
});

const quantity = (name: string) => ({
  name,
  type: 'numeric' as const,
  precision: 24,
  scale: 8,
  transformer: decimalStringTransformer,
});

/**
 * Valuation totals of a run (plan 2.6 step 3) per slice, ledger, loss kind, view and reporting currency:
 * the currency total (null when nothing is valued or an FX rate is missing), the native per-currency sum,
 * line counts and the unvalued quantity / seconds (T38, T45). Views and kinds are separate rows — never
 * added to each other (VAL02). Immutable, written with the run.
 */
@Entity('period_valuation_totals')
@Unique('UQ_period_valuation_totals_cell', [
  'runId',
  'sliceId',
  'ledger',
  'kind',
  'view',
  'currency',
])
@Index('IDX_period_valuation_totals_tenant_period', ['tenantId', 'periodId'])
export class PeriodValuationTotal extends TenantOwnedEntity {
  @Column({ name: 'run_id', type: 'uuid' })
  runId: string;

  @ManyToOne(() => CalculationRun, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'run_id',
    foreignKeyConstraintName: 'FK_period_valuation_totals_run',
  })
  run?: CalculationRun;

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
    name: 'kind',
    type: 'enum',
    enum: LOSS_KINDS,
    enumName: 'loss_line_kind',
  })
  kind: LossKind;

  @Column({
    name: 'view',
    type: 'enum',
    enum: TOTALS_VIEWS,
    enumName: 'valuation_totals_view',
  })
  view: TotalsView;

  @Column({ name: 'currency', type: 'varchar', length: 3 })
  currency: string;

  @Column({ name: 'uom', type: 'varchar', length: 50, nullable: true })
  uom: string | null;

  @Column(money('amount', true))
  amount: string | null;

  @Column(money('native_amount', false))
  nativeAmount: string;

  @Column({ name: 'valued_lines', type: 'int' })
  valuedLines: number;

  @Column({ name: 'unvalued_lines', type: 'int' })
  unvaluedLines: number;

  @Column({ name: 'fx_missing_lines', type: 'int' })
  fxMissingLines: number;

  @Column(quantity('unvalued_quantity'))
  unvaluedQuantity: string;

  @Column(quantity('unvalued_seconds'))
  unvaluedSeconds: string;

  /** valued | unvalued | mixed */
  @Column({ name: 'status', type: 'varchar', length: 16 })
  status: string;

  @Column({ name: 'reasons', type: 'jsonb', default: () => "'[]'" })
  reasons: string[];

  @Column({ name: 'fx_rate_ids', type: 'jsonb', default: () => "'[]'" })
  fxRateIds: string[];
}
