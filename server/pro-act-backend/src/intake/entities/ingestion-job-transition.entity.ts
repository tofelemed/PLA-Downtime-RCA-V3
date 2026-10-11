import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { IngestionJob } from './ingestion-job.entity';

/**
 * Audit trail of a job's lifecycle (ING02 "start/pause/drain/resume/replay/stop audited"): every state
 * change and every lease take-over, by a user command or by a runner. Append-only.
 */
@Entity('ingestion_job_transitions')
@Index('IDX_ingestion_job_transitions_job_at', ['jobId', 'createdAt'])
export class IngestionJobTransition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'job_id', type: 'uuid' })
  jobId: string;

  @ManyToOne(() => IngestionJob, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job?: IngestionJob;

  /** `start`, `pause`, `resume`, `drain`, `stop`, `lease_taken`, `lease_reclaimed`, `failed`, `drained`, `config_changed` */
  @Column({ name: 'action', type: 'varchar', length: 32 })
  action: string;

  @Column({ name: 'from_state', type: 'varchar', length: 16 })
  fromState: string;

  @Column({ name: 'to_state', type: 'varchar', length: 16 })
  toState: string;

  /** user id, or null for a runner */
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  /** runner identity for lease events */
  @Column({ name: 'runner', type: 'text', nullable: true })
  runner: string | null;

  @Column({ name: 'detail', type: 'jsonb', nullable: true })
  detail: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
