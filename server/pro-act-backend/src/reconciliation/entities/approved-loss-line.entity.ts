import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AccountingRevision } from '../../accounting/entities/accounting-revision.entity';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { LOSS_KINDS, LossKind } from '../../domain/accounting/accounting.types';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';

/**
 * One line of the plan ledger an approver signed (VA-01b): a candidate at its decided quantity (rejected
 * and replaced candidates are absent) or a manual / replacing line, with the codes and cause it carries.
 * Written in the approval transaction, immutable. The loss tree and the RCA approved impact read these,
 * so their figures are the approved ones, not the run's proposals.
 */
@Entity('approved_loss_lines')
@Index('IDX_approved_loss_lines_tenant_revision', ['tenantId', 'revisionId'])
@Index('IDX_approved_loss_lines_tenant_cause', ['tenantId', 'causeEventId'])
export class ApprovedLossLine extends TenantScopedEntity {
  @Column({ name: 'revision_id', type: 'uuid' })
  revisionId: string;

  @ManyToOne(() => AccountingRevision, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'revision_id',
    foreignKeyConstraintName: 'FK_approved_loss_lines_revision',
  })
  revision?: AccountingRevision;

  @Column({ name: 'period_id', type: 'uuid' })
  periodId: string;

  @Column({ name: 'slice_id', type: 'uuid' })
  sliceId: string;

  /** candidate (a loss line of the run) or line (a reconciliation line) */
  @Column({ name: 'source', type: 'varchar', length: 16 })
  source: string;

  /** the loss line or reconciliation line it comes from */
  @Column({ name: 'source_id', type: 'uuid' })
  sourceId: string;

  /** the event the line explains (candidate cause, or the first evidence event of a manual line) */
  @Column({ name: 'cause_event_id', type: 'uuid', nullable: true })
  causeEventId: string | null;

  @Column({
    name: 'kind',
    type: 'enum',
    enum: LOSS_KINDS,
    enumName: 'loss_line_kind',
  })
  kind: LossKind;

  @Column({
    name: 'oee_component',
    type: 'varchar',
    length: 16,
    nullable: true,
  })
  oeeComponent: string | null;

  @Column({ name: 'reason_code_id', type: 'uuid', nullable: true })
  reasonCodeId: string | null;

  @Column({ name: 'impact_code_id', type: 'uuid', nullable: true })
  impactCodeId: string | null;

  @Column({ name: 'uom', type: 'varchar', length: 50, nullable: true })
  uom: string | null;

  @Column({
    name: 'quantity',
    type: 'numeric',
    precision: 24,
    scale: 8,
    transformer: decimalStringTransformer,
  })
  quantity: string;
}
