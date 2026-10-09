import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { ProductionPeriod } from './production-period.entity';

export const ACTUALS_JOB_KINDS = ['recompute', 'report_import'] as const;
export type ActualsJobKind = (typeof ACTUALS_JOB_KINDS)[number];
export const ACTUALS_JOB_STATES = [
  'queued',
  'running',
  'completed',
  'failed',
] as const;
export type ActualsJobState = (typeof ACTUALS_JOB_STATES)[number];

/** What a job was asked to do and the requester's unit scope when it was accepted (null = tenant-wide). */
export interface ActualsJobRequest {
  trigger: string;
  scopeUnitIds: string[] | null;
  /** report_import: the CSV document */
  csv?: string;
}

/**
 * Leased background work of plan 2.4 (API04: 202 + job): `recompute` runs the actuals of one period,
 * `report_import` applies an external-report CSV. Claimed with `FOR UPDATE SKIP LOCKED` under a lease
 * (plan 1.5 pattern); at most one queued recompute per period (partial unique index) so repeated
 * triggers collapse into one run.
 */
@Entity('actuals_jobs')
@Index('IDX_actuals_jobs_state_created', ['state', 'createdAt'])
@Index('IDX_actuals_jobs_period', ['periodId'])
@Index('UQ_actuals_jobs_queued_period', ['periodId'], {
  unique: true,
  where: `"state" = 'queued' AND "kind" = 'recompute'`,
})
export class ActualsJob extends TenantScopedEntity {
  @Column({
    name: 'kind',
    type: 'enum',
    enum: ACTUALS_JOB_KINDS,
    enumName: 'actuals_job_kind',
  })
  kind: ActualsJobKind;

  @Column({
    name: 'state',
    type: 'enum',
    enum: ACTUALS_JOB_STATES,
    enumName: 'actuals_job_state',
    default: 'queued',
  })
  state: ActualsJobState;

  @Column({ name: 'period_id', type: 'uuid', nullable: true })
  periodId: string | null;

  @ManyToOne(() => ProductionPeriod, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({
    name: 'period_id',
    foreignKeyConstraintName: 'FK_actuals_jobs_period',
  })
  period?: ProductionPeriod | null;

  @Column({ name: 'request', type: 'jsonb' })
  request: ActualsJobRequest;

  @Column({ name: 'result', type: 'jsonb', nullable: true })
  result: Record<string, unknown> | null;

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
