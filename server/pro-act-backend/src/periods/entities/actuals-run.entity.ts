import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { ProductionPeriod } from './production-period.entity';

/** A policy version a run used (FND03). */
export interface PolicyVersionRef {
  id: string;
  kind: string;
  version: number;
}

/**
 * One immutable actuals computation of a period (plan 2.4, ACT06): the trigger, a hash of every input
 * (slices, policies, events, samples, adjustments, report lines) and the engine version. A new run is
 * only written when the input hash changes, so a loss-explanation change never creates a new actuals
 * result (T44); the 2.5 calculation run references the actuals run it used.
 */
@Entity('actuals_runs')
@Index('IDX_actuals_runs_period_created', ['periodId', 'createdAt'])
export class ActualsRun extends TenantScopedEntity {
  @Column({ name: 'period_id', type: 'uuid' })
  periodId: string;

  @ManyToOne(() => ProductionPeriod, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'period_id',
    foreignKeyConstraintName: 'FK_actuals_runs_period',
  })
  period?: ProductionPeriod;

  @Column({ name: 'trigger', type: 'varchar', length: 64 })
  trigger: string;

  @Column({ name: 'input_hash', type: 'varchar', length: 64 })
  inputHash: string;

  @Column({ name: 'engine_version', type: 'varchar', length: 32 })
  engineVersion: string;

  @Column({ name: 'policy_versions', type: 'jsonb' })
  policyVersions: PolicyVersionRef[];

  @Column({ name: 'requested_by', type: 'uuid', nullable: true })
  requestedBy: string | null;

  @Column({ name: 'supersedes_run_id', type: 'uuid', nullable: true })
  supersedesRunId: string | null;

  @Column({ name: 'computed_at', type: 'timestamptz' })
  computedAt: Date;
}
