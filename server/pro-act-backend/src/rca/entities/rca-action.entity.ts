import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import {
  ActionBaseline,
  PostActionObservation,
  RealizedResult,
} from '../../domain/rca/rca-verification';
import {
  EffectivenessResult,
  ExposureWindow,
} from '../../domain/rca/effectiveness';
import { decimalStringTransformer } from '../../v2/common/decimal-string.transformer';
import { RCA } from '../rca.entity';

export const RCA_ACTION_STATUSES = [
  'open',
  'in_progress',
  'done',
  'cancelled',
] as const;
export type RcaActionStatus = (typeof RCA_ACTION_STATUSES)[number];

/** CA4 action types; each names the objective evidence it needs (`ACTION_EVIDENCE`). */
export const RCA_ACTION_TYPES = [
  'repair',
  'design_change',
  'procedure_change',
  'instrument_change',
  'training',
  'other',
] as const;
export type RcaActionType = (typeof RCA_ACTION_TYPES)[number];

/** A completion evidence file (stored by `POST /v2/rcas/{id}/attachments`). */
export interface CompletionAttachment {
  fileName: string;
  name: string;
}

/** Stored post-action result of the verification job. */
export interface StoredPostAction extends PostActionObservation {
  from: string;
  to: string;
  evaluatedAt: string;
  realized: RealizedResult;
  /** CA2: same-mode incidents and run-time exposure of the verification window (absent before CA2) */
  exposure?: ExposureWindow;
  /** CA2 verdict against the frozen baseline and criteria (absent for baselines typed before CA3) */
  effectiveness?: EffectivenessResult;
}

/**
 * A corrective action of an RCA case (plan 3.9, RCA03): owner, due date, status, completion evidence,
 * verification window and baseline. The verification job stores what was observed after the action
 * (`post_action`); the person's claimed avoided loss stays a separate number.
 */
@Entity('rca_actions')
@Index('IDX_rca_actions_tenant_rca', ['tenantId', 'rcaId'])
@Index('IDX_rca_actions_verification_due', [
  'tenantId',
  'verificationWindowEnd',
])
@Check(
  'CHK_rca_actions_action_type',
  `"action_type" IS NULL OR "action_type" IN ('repair', 'design_change', 'procedure_change', 'instrument_change', 'training', 'other')`,
)
@Check(
  'CHK_rca_actions_window',
  '"verification_window_end" IS NULL OR "verification_window_end" > "verification_window_start"',
)
export class RcaAction extends TenantScopedEntity {
  @Column({ name: 'rca_id', type: 'uuid' })
  rcaId: string;

  @ManyToOne(() => RCA, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'rca_id',
    foreignKeyConstraintName: 'FK_rca_actions_rca',
  })
  rca?: RCA;

  @Column({ name: 'title', type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  ownerId: string | null;

  @Column({ name: 'due_date', type: 'timestamptz', nullable: true })
  dueDate: Date | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: RCA_ACTION_STATUSES,
    enumName: 'rca_action_status',
  })
  status: RcaActionStatus;

  @Column({ name: 'completion_evidence_ref', type: 'text', nullable: true })
  completionEvidenceRef: string | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  /** CA4: what kind of action, which decides the evidence expected (repair, design change, ...) */
  @Column({ name: 'action_type', type: 'varchar', length: 32, nullable: true })
  actionType: RcaActionType | null;

  /** CA4: who checked the completion evidence and marked the action done (never its owner) */
  @Column({ name: 'completion_verified_by', type: 'uuid', nullable: true })
  completionVerifiedBy: string | null;

  /** CA4: files of the case's upload area that prove the completion (test report, drawing, record) */
  @Column({ name: 'completion_attachments', type: 'jsonb', nullable: true })
  completionAttachments: CompletionAttachment[] | null;

  @Column({
    name: 'verification_window_start',
    type: 'timestamptz',
    nullable: true,
  })
  verificationWindowStart: Date | null;

  @Column({
    name: 'verification_window_end',
    type: 'timestamptz',
    nullable: true,
  })
  verificationWindowEnd: Date | null;

  @Column({ name: 'baseline', type: 'jsonb', nullable: true })
  baseline: ActionBaseline | null;

  @Column({ name: 'post_action', type: 'jsonb', nullable: true })
  postAction: StoredPostAction | null;

  @Column({
    name: 'claimed_avoided_loss',
    type: 'numeric',
    precision: 24,
    scale: 8,
    nullable: true,
    transformer: decimalStringTransformer,
  })
  claimedAvoidedLoss: string | null;

  /** currency (IRR / USD) of the claimed avoided loss */
  @Column({
    name: 'claimed_currency',
    type: 'varchar',
    length: 3,
    nullable: true,
  })
  claimedCurrency: string | null;
}
