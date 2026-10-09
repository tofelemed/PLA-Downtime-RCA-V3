import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import {
  ActualsRun,
  PolicyVersionRef,
} from '../../periods/entities/actuals-run.entity';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';
import { AccountingRevision } from './accounting-revision.entity';

export const RUN_STATUSES = [
  'queued',
  'running',
  'validated',
  'failed',
  'superseded',
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

/** Everything a run read, by identity and version (FND03): equal fingerprints give equal lines. */
export interface InputFingerprint {
  periodId: string;
  window: { start: string; end: string };
  sliceIds: string[];
  eventRevisions: Array<{
    eventId: string;
    revisionId: string | null;
    rowVersion: number;
  }>;
  occurrenceIds: string[];
  actualsRunId: string | null;
  planVersionId: string | null;
  planPeriodIds: string[];
  rateVersionIds: string[];
  calendarVersionIds: string[];
  /** set only while the period is running and an open event is measured to it (else null) */
  asOf: string | null;
}

export interface RunError {
  code: string;
  message: string;
  sliceId: string | null;
}

/**
 * One immutable calculation of a period's loss ledgers (spec §14.2 `calculation_runs`, FND03): the
 * accounting revision it belongs to, the actuals run it used (2.4), the engine and policy versions, the
 * input fingerprint and its hash, and the lifecycle `running → validated | failed`, later `superseded`
 * when a newer run replaces it. Only the status columns change after insert.
 */
@Entity('calculation_runs')
@Index('IDX_calculation_runs_period_created', ['periodId', 'createdAt'])
@Index('IDX_calculation_runs_revision', ['revisionId'])
@Index('IDX_calculation_runs_actuals_run', ['actualsRunId'])
export class CalculationRun extends TenantScopedEntity {
  @Column({ name: 'period_id', type: 'uuid' })
  periodId: string;

  @ManyToOne(() => ProductionPeriod, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'period_id',
    foreignKeyConstraintName: 'FK_calculation_runs_period',
  })
  period?: ProductionPeriod;

  @Column({ name: 'revision_id', type: 'uuid' })
  revisionId: string;

  @ManyToOne(() => AccountingRevision, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'revision_id',
    foreignKeyConstraintName: 'FK_calculation_runs_revision',
  })
  revision?: AccountingRevision;

  @Column({ name: 'actuals_run_id', type: 'uuid', nullable: true })
  actualsRunId: string | null;

  @ManyToOne(() => ActualsRun, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'actuals_run_id',
    foreignKeyConstraintName: 'FK_calculation_runs_actuals_run',
  })
  actualsRun?: ActualsRun | null;

  @Column({ name: 'trigger', type: 'varchar', length: 64 })
  trigger: string;

  @Column({ name: 'engine_version', type: 'varchar', length: 32 })
  engineVersion: string;

  @Column({ name: 'policy_versions', type: 'jsonb' })
  policyVersions: PolicyVersionRef[];

  @Column({ name: 'input_fingerprint', type: 'jsonb' })
  inputFingerprint: InputFingerprint;

  @Column({ name: 'input_hash', type: 'varchar', length: 64 })
  inputHash: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: RUN_STATUSES,
    enumName: 'calculation_run_status',
  })
  status: RunStatus;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'error', type: 'jsonb', nullable: true })
  error: RunError[] | null;

  @Column({ name: 'stats', type: 'jsonb', default: () => "'{}'" })
  stats: Record<string, number>;

  @Column({ name: 'requested_by', type: 'uuid', nullable: true })
  requestedBy: string | null;

  @Column({ name: 'supersedes_run_id', type: 'uuid', nullable: true })
  supersedesRunId: string | null;
}
