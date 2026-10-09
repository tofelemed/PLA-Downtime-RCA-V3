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
 * lifecycle and the calculation run it currently shows. Plan 2.5 creates and recalculates the draft;
 * review, approval and revise (new draft superseding an approved one) are 2.8. At most one draft and one
 * approved revision per period (partial unique indexes); an approved revision is never recalculated.
 */
@Entity('accounting_revisions')
@Unique('UQ_accounting_revisions_period_revision', ['periodId', 'revision'])
@Index('UQ_accounting_revisions_period_approved', ['periodId'], {
  unique: true,
  where: `"lifecycle" = 'approved'`,
})
@Index('UQ_accounting_revisions_period_draft', ['periodId'], {
  unique: true,
  where: `"lifecycle" = 'draft'`,
})
@Index('IDX_accounting_revisions_current_run', ['currentRunId'])
@Index('IDX_accounting_revisions_supersedes', ['supersedesId'])
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
}
