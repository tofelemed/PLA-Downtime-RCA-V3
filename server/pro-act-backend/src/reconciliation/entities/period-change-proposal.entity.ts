import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AccountingRevision } from '../../accounting/entities/accounting-revision.entity';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';

export const CHANGE_TRIGGERS = [
  'event_change',
  'actuals_change',
  'plan_change',
  'rate_change',
  'calendar_change',
  'source_retraction',
  'recalculation',
  // a correction a user proposes for a period of a closing or locked month (SME R4)
  'manual_correction',
] as const;
export type ChangeTrigger = (typeof CHANGE_TRIGGERS)[number];

export const PROPOSAL_STATES = ['open', 'accepted', 'dismissed'] as const;
export type ProposalState = (typeof PROPOSAL_STATES)[number];

/** A completed export containing the approved revision (plan 2.9), listed on its change proposal. */
export interface AffectedReport {
  exportId: string;
  reportType: string;
  contentHash: string | null;
  generatedAt: string | null;
}

/**
 * A change that reached an approved period (spec §14.2 `period_change_proposals`, WF04): the approved
 * revision it concerns, what triggered it, the approved totals (`before`) and a preview computed from the
 * new inputs without writing a run (`after`). Approved accounting is never edited: accepting the proposal
 * opens a revise draft (`created_revision_id`), dismissing it records the reason. At most one open
 * proposal per approved revision; a later change refreshes it.
 */
@Entity('period_change_proposals')
@Index('IDX_approval_inbox_period_change_proposals', { synchronize: false })
@Index('UQ_period_change_proposals_open', ['approvedRevisionId'], {
  unique: true,
  where: `"state" = 'open'`,
})
@Index('IDX_period_change_proposals_tenant_period_created', [
  'tenantId',
  'periodId',
  'createdAt',
])
@Index('IDX_period_change_proposals_approved_revision', ['approvedRevisionId'])
@Index('IDX_period_change_proposals_created_revision', ['createdRevisionId'])
export class PeriodChangeProposal extends TenantScopedEntity {
  @Column({ name: 'period_id', type: 'uuid' })
  periodId: string;

  @ManyToOne(() => ProductionPeriod, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'period_id',
    foreignKeyConstraintName: 'FK_period_change_proposals_period',
  })
  period?: ProductionPeriod;

  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @Column({ name: 'approved_revision_id', type: 'uuid' })
  approvedRevisionId: string;

  @ManyToOne(() => AccountingRevision, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'approved_revision_id',
    foreignKeyConstraintName: 'FK_period_change_proposals_approved_revision',
  })
  approvedRevision?: AccountingRevision;

  @Column({
    name: 'trigger',
    type: 'enum',
    enum: CHANGE_TRIGGERS,
    enumName: 'period_change_trigger',
  })
  trigger: ChangeTrigger;

  @Column({
    name: 'state',
    type: 'enum',
    enum: PROPOSAL_STATES,
    enumName: 'period_change_proposal_state',
    default: 'open',
  })
  state: ProposalState;

  /** input hash of the change (null for a plan restatement, computed when accepted) */
  @Column({ name: 'input_hash', type: 'varchar', length: 64, nullable: true })
  inputHash: string | null;

  @Column({ name: 'before', type: 'jsonb' })
  before: Record<string, unknown>;

  @Column({ name: 'after', type: 'jsonb', nullable: true })
  after: Record<string, unknown> | null;

  @Column({ name: 'affected_reports', type: 'jsonb', default: () => "'[]'" })
  affectedReports: AffectedReport[];

  @Column({ name: 'detail', type: 'jsonb', default: () => "'{}'" })
  detail: Record<string, unknown>;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolution_reason', type: 'text', nullable: true })
  resolutionReason: string | null;

  @Column({ name: 'created_revision_id', type: 'uuid', nullable: true })
  createdRevisionId: string | null;

  @ManyToOne(() => AccountingRevision, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'created_revision_id',
    foreignKeyConstraintName: 'FK_period_change_proposals_created_revision',
  })
  createdRevision?: AccountingRevision | null;
}
