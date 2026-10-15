import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { AccountingRevision } from '../../accounting/entities/accounting-revision.entity';
import { TenantOwnedEntity } from '../../common/entities/tenant-scoped.entity';
import { LOSS_KINDS, LossKind } from '../../domain/accounting/accounting.types';
import { TotalsView } from '../../domain/valuation/valuation.types';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';
import { TOTALS_VIEWS } from './period-valuation-total.entity';

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
 * Valuation totals of an approved revision (VA-01): the reconciled plan ledger the approver signed —
 * decided candidates at their decided quantity, manual and replacing lines valued from the run's frozen
 * context — per slice, loss kind, view and reporting currency, with the same columns as the run's
 * `period_valuation_totals`. Written once in the approval transaction; immutable. Reports read these for
 * approved periods so the value shown is the value approved and exported.
 */
@Entity('approved_valuation_totals')
@Unique('UQ_approved_valuation_totals_cell', [
  'revisionId',
  'sliceId',
  'kind',
  'view',
  'currency',
])
@Index('IDX_approved_valuation_totals_tenant_period', ['tenantId', 'periodId'])
export class ApprovedValuationTotal extends TenantOwnedEntity {
  @Column({ name: 'revision_id', type: 'uuid' })
  revisionId: string;

  @ManyToOne(() => AccountingRevision, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'revision_id',
    foreignKeyConstraintName: 'FK_approved_valuation_totals_revision',
  })
  revision?: AccountingRevision;

  @Column({ name: 'period_id', type: 'uuid' })
  periodId: string;

  @Column({ name: 'slice_id', type: 'uuid' })
  sliceId: string;

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

  /** SME V7: valued lines whose amount used a provisional FX rate */
  @Column({ name: 'fx_provisional_lines', type: 'int', default: 0 })
  fxProvisionalLines: number;

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
