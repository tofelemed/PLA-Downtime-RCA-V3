import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';

export const REVISION_LIFECYCLES = [
  'draft',
  'in_review',
  'approved',
  'cancelled',
] as const;
export type RevisionLifecycle = (typeof REVISION_LIFECYCLES)[number];

/**
 * The accounting container of a period (spec §14.2 `accounting_revisions`): a numbered revision with its
 * lifecycle and the calculation run it currently shows. Plan 2.5 creates and recalculates the draft; plan
 * 2.8 adds the workflow columns (submission, approval, rejection, cancellation, stale marking, the current
 * reconciliation line set). At most one open (draft or in review) revision per period; approved revisions
 * are never updated (trigger) — the latest approved one is the published revision, a revise opens a new
 * draft that supersedes it.
 */
@Entity('accounting_revisions')
@Unique('UQ_accounting_revisions_period_revision', ['periodId', 'revision'])
@Index('UQ_accounting_revisions_period_open', ['periodId'], {
  unique: true,
  where: `"lifecycle" IN ('draft', 'in_review')`,
})
@Index('IDX_accounting_revisions_current_run', ['currentRunId'])
@Index('IDX_accounting_revisions_supersedes', ['supersedesId'])
/** approved revisions by approval time (2.9 delivery reconciliation) */
@Index('IDX_accounting_revisions_tenant_approved', ['tenantId', 'approvedAt'], {
  where: `"lifecycle" = 'approved'`,
})
export class AccountingRevision extends TenantScopedEntity {
  @Column({ name: 'period_id', type: 'uuid' })
  periodId: string;

  @ManyToOne(() => ProductionPeriod, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'period_id',
    foreignKeyConstraintName: 'FK_accounting_revisions_period',
  })
  period?: ProductionPeriod;

  @Column({ name: 'revision', type: 'int' })
  revision: number;

  @Column({
    name: 'lifecycle',
    type: 'enum',
    enum: REVISION_LIFECYCLES,
    enumName: 'accounting_revision_lifecycle',
    default: 'draft',
  })
  lifecycle: RevisionLifecycle;

  /** the approved revision this draft revises (2.8) */
  @Column({ name: 'supersedes_id', type: 'uuid', nullable: true })
  supersedesId: string | null;

  /** input hash of the current run */
  @Column({ name: 'input_hash', type: 'varchar', length: 64, nullable: true })
  inputHash: string | null;

  /** the validated run the revision shows (no FK: runs reference revisions) */
  @Column({ name: 'current_run_id', type: 'uuid', nullable: true })
  currentRunId: string | null;

  /** the reconciliation line set the revision shows (2.8; no FK: sets reference revisions) */
  @Column({ name: 'current_line_set_id', type: 'uuid', nullable: true })
  currentLineSetId: string | null;

  @Column({ name: 'submitted_by', type: 'uuid', nullable: true })
  submittedBy: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  /** sha256 of the reviewed content (approval needs the same hash) */
  @Column({
    name: 'submitted_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  submittedHash: string | null;

  @Column({ name: 'submitted_run_id', type: 'uuid', nullable: true })
  submittedRunId: string | null;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'approval_snapshot_id', type: 'uuid', nullable: true })
  approvalSnapshotId: string | null;

  @Column({ name: 'rejected_by', type: 'uuid', nullable: true })
  rejectedBy: string | null;

  @Column({ name: 'rejected_at', type: 'timestamptz', nullable: true })
  rejectedAt: Date | null;

  @Column({ name: 'reject_reason', type: 'text', nullable: true })
  rejectReason: string | null;

  @Column({ name: 'cancelled_by', type: 'uuid', nullable: true })
  cancelledBy: string | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  /** set while in review when an input changed after submission (approve answers 409) */
  @Column({ name: 'is_stale', type: 'boolean', default: false })
  isStale: boolean;

  @Column({ name: 'stale_reason', type: 'text', nullable: true })
  staleReason: string | null;

  /** the latest workflow comment or reason (submit, approve, reject, revise, cancel) */
  @Column({ name: 'comment', type: 'text', nullable: true })
  comment: string | null;
}
