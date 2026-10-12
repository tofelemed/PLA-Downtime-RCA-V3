import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import {
  Ledger,
  LEDGERS,
  LOSS_BASES,
  LOSS_KINDS,
  LossBasis,
  LossKind,
} from '../../domain/accounting/accounting.types';
import { PeriodProductSlice } from '../../periods/entities/period-product-slice.entity';
import { UnitProductRate } from '../../profiles/entities/unit-product-rate.entity';
import { StoredLineValuation } from '../../domain/valuation/valuation-snapshot';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';
import { AccountingRevision } from './accounting-revision.entity';
import { CalculationRun } from './calculation-run.entity';

export const LINE_SOURCES = ['auto', 'manual', 'candidate_superseded'] as const;
export type LineSource = (typeof LINE_SOURCES)[number];

export const LINE_STATES = ['active', 'superseded', 'rejected'] as const;
export type LineState = (typeof LINE_STATES)[number];

/**
 * One loss line of a run (spec §14.2 `loss_lines`, ACC01–ACC08): ledger, kind, signed quantity (negative
 * only for residual / gain / bridge), basis and rate version, the cause's codes and classification, the
 * clipped segment, and the deterministic `auto_key` of automatic lines (unique per run). Manual lines and
 * overrides are 2.8 reconciliation lines, the valuation snapshot is 2.6. Immutable (trigger `trg_loss_lines_immutable`).
 */
@Entity('loss_lines')
@Index('UQ_loss_lines_run_auto_key', ['runId', 'autoKey'], {
  unique: true,
  where: '"auto_key" IS NOT NULL',
})
@Index('IDX_loss_lines_revision', ['revisionId'])
@Index('IDX_loss_lines_slice', ['sliceId'])
@Index('IDX_loss_lines_rate_version', ['rateVersionId'])
@Index('IDX_loss_lines_tenant_cause_event', ['tenantId', 'causeEventId'])
@Index('IDX_loss_lines_tenant_period', ['tenantId', 'periodId'])
@Index('IDX_loss_lines_run_ledger_kind', ['runId', 'ledger', 'kind'])
export class LossLine extends TenantScopedEntity {
  @Column({ name: 'run_id', type: 'uuid' })
  runId: string;

  @ManyToOne(() => CalculationRun, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'run_id', foreignKeyConstraintName: 'FK_loss_lines_run' })
  run?: CalculationRun;

  @Column({ name: 'revision_id', type: 'uuid' })
  revisionId: string;

  @ManyToOne(() => AccountingRevision, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'revision_id',
    foreignKeyConstraintName: 'FK_loss_lines_revision',
  })
  revision?: AccountingRevision;

  @Column({ name: 'period_id', type: 'uuid' })
  periodId: string;

  @Column({ name: 'slice_id', type: 'uuid' })
  sliceId: string;

  @ManyToOne(() => PeriodProductSlice, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'slice_id',
    foreignKeyConstraintName: 'FK_loss_lines_slice',
  })
  slice?: PeriodProductSlice;

  @Column({ name: 'segment_start', type: 'timestamptz' })
  segmentStart: Date;

  @Column({ name: 'segment_end', type: 'timestamptz' })
  segmentEnd: Date;

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
    enum: LOSS_BASES,
    enumName: 'loss_line_basis',
  })
  basis: LossBasis;

  @Column({ name: 'rate_version_id', type: 'uuid', nullable: true })
  rateVersionId: string | null;

  @ManyToOne(() => UnitProductRate, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'rate_version_id',
    foreignKeyConstraintName: 'FK_loss_lines_rate_version',
  })
  rateVersion?: UnitProductRate | null;

  /** the cause event's reason / impact code (the code row the event referenced at run time) */
  @Column({ name: 'reason_code_id', type: 'uuid', nullable: true })
  reasonCodeId: string | null;

  @Column({ name: 'impact_code_id', type: 'uuid', nullable: true })
  impactCodeId: string | null;

  @Column({
    name: 'oee_component',
    type: 'varchar',
    length: 16,
    nullable: true,
  })
  oeeComponent: string | null;

  @Column({
    name: 'schedule_class',
    type: 'varchar',
    length: 16,
    nullable: true,
  })
  scheduleClass: string | null;

  @Column({ name: 'failure_codes', type: 'jsonb', nullable: true })
  failureCodes: Record<string, unknown> | null;

  @Column({ name: 'loss_category_def_id', type: 'uuid', nullable: true })
  lossCategoryDefId: string | null;

  @Column({
    name: 'source',
    type: 'enum',
    enum: LINE_SOURCES,
    enumName: 'loss_line_source',
  })
  source: LineSource;

  @Column({ name: 'auto_key', type: 'text', nullable: true })
  autoKey: string | null;

  @Column({
    name: 'state',
    type: 'enum',
    enum: LINE_STATES,
    enumName: 'loss_line_state',
  })
  state: LineState;

  @Column({ name: 'comment', type: 'text', nullable: true })
  comment: string | null;

  @Column({ name: 'author_id', type: 'uuid', nullable: true })
  authorId: string | null;

  /** plan 2.6 valuation snapshot (VAL03); null on lines of runs before 2.6 */
  @Column({ name: 'valuation', type: 'jsonb', nullable: true })
  valuation: StoredLineValuation | null;

  @Column({ name: 'cause_event_id', type: 'uuid', nullable: true })
  causeEventId: string | null;

  @Column({ name: 'occurrence_id', type: 'uuid', nullable: true })
  occurrenceId: string | null;

  @Column({ name: 'flags', type: 'jsonb', default: () => "'[]'" })
  flags: string[];
}
