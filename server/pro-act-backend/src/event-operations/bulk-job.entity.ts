import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '../common/entities/tenant-scoped.entity';

export const BULK_JOB_KINDS = ['bulk_code'] as const;
export type BulkJobKind = (typeof BULK_JOB_KINDS)[number];

export const BULK_JOB_STATES = [
  'queued',
  'running',
  'completed',
  'partial',
  'failed',
] as const;
export type BulkJobState = (typeof BULK_JOB_STATES)[number];

/** Outcome of one chunk; each chunk is applied atomically. */
export interface BulkJobChunk {
  index: number;
  size: number;
  state: 'completed' | 'failed';
  /** error code of a failed chunk (STALE_REVISION, INVALID_STATE, ...) */
  errorCode?: string;
  errorMessage?: string;
}

/**
 * A long-running batch command (spec API04, DT10 bulk coding above the atomic limit, plan 1.4). The
 * worker claims queued jobs and applies them chunk by chunk; `chunks` records every chunk's outcome.
 */
@Entity('bulk_jobs')
@Index('IDX_bulk_jobs_state_created', ['state', 'createdAt'])
export class BulkJob extends TenantScopedEntity {
  @Column({
    name: 'kind',
    type: 'enum',
    enum: BULK_JOB_KINDS,
    enumName: 'bulk_job_kind',
  })
  kind: BulkJobKind;

  @Column({
    name: 'state',
    type: 'enum',
    enum: BULK_JOB_STATES,
    enumName: 'bulk_job_state',
    default: 'queued',
  })
  state: BulkJobState;

  @Column({ name: 'total', type: 'int' })
  total: number;

  @Column({ name: 'processed', type: 'int', default: 0 })
  processed: number;

  @Column({ name: 'failed', type: 'int', default: 0 })
  failed: number;

  @Column({ name: 'chunks', type: 'jsonb', default: () => "'[]'" })
  chunks: BulkJobChunk[];

  /** the validated command (items with expected versions, codes, reason) */
  @Column({ name: 'payload', type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ name: 'requested_by', type: 'uuid', nullable: true })
  requestedBy: string | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;
}
