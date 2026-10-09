import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import {
  LOSS_BASES,
  LOSS_KINDS,
  LossBasis,
  LossKind,
} from '../../domain/accounting/accounting.types';
import {
  LINE_ACTIONS,
  LineAction,
} from '../../domain/reconciliation/reconciliation.types';
import { ActualsAdjustment } from '../../periods/entities/actuals-adjustment.entity';
import { PeriodProductSlice } from '../../periods/entities/period-product-slice.entity';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';
import { ReconciliationLineSet } from './reconciliation-line-set.entity';

/** An evidence event of a manual line, pinned to the revision current when the line was saved. */
export interface LineEvidenceRef {
  eventId: string;
  eventRevisionId: string | null;
}

const quantity = (name: string) => ({
  name,
  type: 'numeric' as const,
  precision: 24,
  scale: 8,
  nullable: true,
  transformer: decimalStringTransformer,
});

/**
 * One line of a reconciliation set (plan 2.8, ACC07/ACC08): a decision on an automatic plan candidate
 * (`accept`, `adjust`, `replace`, `reject`, keyed by the candidate's deterministic `auto_key`, with the
 * candidate quantity seen at save time as `base_quantity` so a changed baseline is detected) or a line of
 * its own (`manual` with event / cause-without-event / approved-adjustment evidence, `tolerance` written
 * by submit). Missing code and missing event are distinct flags. Immutable.
 */
@Entity('reconciliation_lines')
@Index('IDX_reconciliation_lines_set', ['lineSetId'])
@Index('IDX_reconciliation_lines_slice', ['sliceId'])
@Index('IDX_reconciliation_lines_adjustment', ['adjustmentId'])
@Index('IDX_reconciliation_lines_tenant_period', ['tenantId', 'periodId'])
export class ReconciliationLine extends TenantScopedEntity {
  @Column({ name: 'line_set_id', type: 'uuid' })
  lineSetId: string;

  @ManyToOne(() => ReconciliationLineSet, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'line_set_id',
    foreignKeyConstraintName: 'FK_reconciliation_lines_set',
  })
  lineSet?: ReconciliationLineSet;

  @Column({ name: 'period_id', type: 'uuid' })
  periodId: string;

  @Column({ name: 'slice_id', type: 'uuid' })
  sliceId: string;

  @ManyToOne(() => PeriodProductSlice, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'slice_id',
    foreignKeyConstraintName: 'FK_reconciliation_lines_slice',
  })
  slice?: PeriodProductSlice;

  @Column({ name: 'position', type: 'int' })
  position: number;

  @Column({
    name: 'action',
    type: 'enum',
    enum: LINE_ACTIONS,
    enumName: 'reconciliation_line_action',
  })
  action: LineAction;

  @Column({ name: 'auto_key', type: 'text', nullable: true })
  autoKey: string | null;

  @Column({
    name: 'kind',
    type: 'enum',
    enum: LOSS_KINDS,
    enumName: 'loss_line_kind',
    nullable: true,
  })
  kind: LossKind | null;

  /** signed only for bridge / gain / tolerance */
  @Column(quantity('quantity'))
  quantity: string | null;

  /** the candidate quantity the editor saw (decisions on candidates) */
  @Column(quantity('base_quantity'))
  baseQuantity: string | null;

  @Column({ name: 'uom', type: 'varchar', length: 50, nullable: true })
  uom: string | null;

  @Column({
    name: 'basis',
    type: 'enum',
    enum: LOSS_BASES,
    enumName: 'loss_line_basis',
    nullable: true,
  })
  basis: LossBasis | null;

  @Column({ name: 'reason_code_id', type: 'uuid', nullable: true })
  reasonCodeId: string | null;

  @Column({ name: 'impact_code_id', type: 'uuid', nullable: true })
  impactCodeId: string | null;

  @Column({ name: 'evidence', type: 'jsonb', default: () => "'[]'" })
  evidence: LineEvidenceRef[];

  @Column({ name: 'adjustment_id', type: 'uuid', nullable: true })
  adjustmentId: string | null;

  @ManyToOne(() => ActualsAdjustment, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'adjustment_id',
    foreignKeyConstraintName: 'FK_reconciliation_lines_adjustment',
  })
  adjustment?: ActualsAdjustment | null;

  @Column({ name: 'missing_code', type: 'boolean', default: false })
  missingCode: boolean;

  @Column({ name: 'missing_event', type: 'boolean', default: false })
  missingEvent: boolean;

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'comment', type: 'text', nullable: true })
  comment: string | null;

  /** null for lines written by the system (tolerance adjustments) */
  @Column({ name: 'author_id', type: 'uuid', nullable: true })
  authorId: string | null;
}
