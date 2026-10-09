import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import {
  Distribution,
  GENERATION_JOB_STATES,
  GenerationJobState,
  PlanWarning,
  UomTotal,
} from '../../domain/plans/plan.types';
import { PlanVersion } from './plan-version.entity';

/** What the job was asked to do, and the requester's unit scope when it was accepted. */
export interface GenerationJobRequest {
  version: number;
  distribution: Distribution | null;
  /** units the requester was limited to (null = tenant-wide); the job never writes outside them */
  scopeUnitIds: string[] | null;
}

export interface GenerationJobResult {
  periods: number;
  headerTarget: string | null;
  totals: UomTotal[];
  warnings: PlanWarning[];
}

/**
 * A persisted period generation (plan 2.3, API04: 202 + job). The worker claims queued jobs with
 * `FOR UPDATE SKIP LOCKED` under a lease (plan 1.5 pattern), regenerates the draft's periods in one
 * transaction and records the result or the refusal code.
 */
@Entity('plan_generation_jobs')
@Index('IDX_plan_generation_jobs_state_created', ['state', 'createdAt'])
@Index('IDX_plan_generation_jobs_version', ['planVersionId'])
export class PlanGenerationJob extends TenantScopedEntity {
  @Column({ name: 'plan_id', type: 'uuid' })
  planId: string;

  @Column({ name: 'plan_version_id', type: 'uuid' })
  planVersionId: string;

  @ManyToOne(() => PlanVersion, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'plan_version_id',
    foreignKeyConstraintName: 'FK_plan_generation_jobs_version',
  })
  planVersion?: PlanVersion;

  @Column({
    name: 'state',
    type: 'enum',
    enum: GENERATION_JOB_STATES,
    enumName: 'plan_generation_job_state',
    default: 'queued',
  })
  state: GenerationJobState;

  @Column({ name: 'request', type: 'jsonb' })
  request: GenerationJobRequest;

  @Column({ name: 'result', type: 'jsonb', nullable: true })
  result: GenerationJobResult | null;

  @Column({ name: 'error_code', type: 'varchar', length: 64, nullable: true })
  errorCode: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'requested_by', type: 'uuid', nullable: true })
  requestedBy: string | null;

  @Column({ name: 'lease_owner', type: 'text', nullable: true })
  leaseOwner: string | null;

  @Column({ name: 'lease_expiry', type: 'timestamptz', nullable: true })
  leaseExpiry: Date | null;

  @Column({ name: 'attempts', type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;
}
