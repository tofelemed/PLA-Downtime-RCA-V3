import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AccountingRevision } from '../../accounting/entities/accounting-revision.entity';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';

/** How finance treats a restatement (SME R5, IAS 8 distinguishes errors from changes in estimates). */
export const POSTING_TREATMENTS = [
  'correction',
  'estimate_change',
  'other_adjustment',
  'no_posting',
] as const;
export type PostingTreatment = (typeof POSTING_TREATMENTS)[number];

/**
 * Finance's decision on a restated revision (SME R5): the operational effective date (the production
 * period's date — what the figures describe) kept apart from the financial posting date finance chooses,
 * and the treatment. One row per restated revision, decided once (409 POSTING_DECIDED afterwards; owner decision 2026-10-19).
 */
@Entity('restatement_postings')
@Index('UQ_restatement_postings_revision', ['revisionId'], { unique: true })
@Index('IDX_restatement_postings_tenant_period', ['tenantId', 'periodId'])
@Check(
  'CHK_restatement_postings_treatment',
  `"treatment" IN ('correction', 'estimate_change', 'other_adjustment', 'no_posting')`,
)
export class RestatementPosting extends TenantScopedEntity {
  @Column({ name: 'revision_id', type: 'uuid' })
  revisionId: string;

  @ManyToOne(() => AccountingRevision, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'revision_id',
    foreignKeyConstraintName: 'FK_restatement_postings_revision',
  })
  revision?: AccountingRevision;

  @Column({ name: 'period_id', type: 'uuid' })
  periodId: string;

  @ManyToOne(() => ProductionPeriod, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'period_id',
    foreignKeyConstraintName: 'FK_restatement_postings_period',
  })
  period?: ProductionPeriod;

  @Column({ name: 'operational_effective_date', type: 'date' })
  operationalEffectiveDate: string;

  @Column({ name: 'posting_date', type: 'date' })
  postingDate: string;

  @Column({ name: 'treatment', type: 'varchar', length: 24 })
  treatment: PostingTreatment;

  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'decided_by', type: 'uuid' })
  decidedBy: string;

  @Column({ name: 'decided_at', type: 'timestamptz' })
  decidedAt: Date;
}
