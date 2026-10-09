import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AccountingRevision } from '../../accounting/entities/accounting-revision.entity';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';

/**
 * Everything an approval rested on (spec §14.2 `approval_snapshots`, WF03): the reviewed content (run with
 * its input fingerprint and policy versions, actuals, both ledgers' totals, candidates, reconciliation
 * lines, per-slice totals) whose sha256 is the submitted hash, plus submitter, approver, times and
 * comments. One per approved revision; immutable and retained (NFR07).
 */
@Entity('approval_snapshots')
@Index('UQ_approval_snapshots_revision', ['revisionId'], { unique: true })
@Index('IDX_approval_snapshots_tenant_period', ['tenantId', 'periodId'])
export class ApprovalSnapshot extends TenantScopedEntity {
  @Column({ name: 'revision_id', type: 'uuid' })
  revisionId: string;

  @ManyToOne(() => AccountingRevision, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'revision_id',
    foreignKeyConstraintName: 'FK_approval_snapshots_revision',
  })
  revision?: AccountingRevision;

  @Column({ name: 'period_id', type: 'uuid' })
  periodId: string;

  @Column({ name: 'content', type: 'jsonb' })
  content: Record<string, unknown>;

  /** sha256 over the whole snapshot content */
  @Column({ name: 'content_hash', type: 'varchar', length: 64 })
  contentHash: string;

  /** sha256 over the reviewed part (= the revision's submitted hash) */
  @Column({ name: 'submitted_hash', type: 'varchar', length: 64 })
  submittedHash: string;
}
