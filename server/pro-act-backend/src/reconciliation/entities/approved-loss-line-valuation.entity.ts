import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import {
  VALUATION_VIEWS,
  ValuationView,
} from '../../domain/valuation/valuation.types';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';
import { ApprovedLossLine } from './approved-loss-line.entity';

/**
 * Value of an approved plan line per view and reporting currency (VA-01b), same columns as
 * `loss_line_valuations`: amount null = unvalued or no approved FX rate (never zero). Immutable.
 */
@Entity('approved_loss_line_valuations')
@Unique('UQ_approved_loss_line_valuations_cell', [
  'approvedLineId',
  'view',
  'currency',
])
@Index('IDX_approved_loss_line_valuations_line', ['approvedLineId'])
export class ApprovedLossLineValuation extends TenantScopedEntity {
  @Column({ name: 'approved_line_id', type: 'uuid' })
  approvedLineId: string;

  @ManyToOne(() => ApprovedLossLine, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'approved_line_id',
    foreignKeyConstraintName: 'FK_approved_loss_line_valuations_line',
  })
  approvedLine?: ApprovedLossLine;

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

  /** valued | unvalued */
  @Column({ name: 'status', type: 'varchar', length: 16 })
  status: string;

  @Column({ name: 'reason', type: 'varchar', length: 64, nullable: true })
  reason: string | null;

  /** SME V7: the amount was converted with an authorised provisional FX rate */
  @Column({ name: 'provisional', type: 'boolean', default: false })
  provisional: boolean;
}
