import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { IntegrationConnection } from './integration-connection.entity';

export const REPLAY_RUN_STATES = [
  'queued',
  'running',
  'completed',
  'failed',
] as const;
export type ReplayRunState = (typeof REPLAY_RUN_STATES)[number];

/** Which source objects a replay covers; empty = every object of the connection in the window. */
export interface ReplayScopes {
  sourceObjectIds?: string[];
  exceptionIds?: string[];
}

export interface ReplayCounts {
  objects: number;
  normalized: number;
  quarantined: number;
  unchanged: number;
  failed: number;
}

/**
 * Replay of retained raw observations (spec ING05, §14.2 `replay_runs`): the latest accepted version of
 * each source object in scope is re-delivered through intake with its original message id and this
 * run's id, then normalised with the current mappings. Runs in the worker under a lease like any job.
 */
@Entity('replay_runs')
@Index('IDX_replay_runs_state_created', ['state', 'createdAt'])
@Index('IDX_replay_runs_tenant_connection', ['tenantId', 'connectionId'])
export class ReplayRun extends TenantScopedEntity {
  @Column({ name: 'connection_id', type: 'uuid' })
  connectionId: string;

  @ManyToOne(() => IntegrationConnection, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'connection_id' })
  connection?: IntegrationConnection;

  /** source observation window (latest observation time), half-open; null = unbounded */
  @Column({ name: 'from_time', type: 'timestamptz', nullable: true })
  fromTime: Date | null;

  @Column({ name: 'to_time', type: 'timestamptz', nullable: true })
  toTime: Date | null;

  @Column({ name: 'scopes', type: 'jsonb', default: () => "'{}'" })
  scopes: ReplayScopes;

  @Column({ name: 'reason', type: 'text' })
  reason: string;

  @Column({ name: 'dry_run', type: 'boolean', default: false })
  dryRun: boolean;

  @Column({
    name: 'state',
    type: 'enum',
    enum: REPLAY_RUN_STATES,
    enumName: 'replay_run_state',
    default: 'queued',
  })
  state: ReplayRunState;

  @Column({ name: 'counts', type: 'jsonb', default: () => "'{}'" })
  counts: Partial<ReplayCounts>;

  @Column({ name: 'requested_by', type: 'uuid', nullable: true })
  requestedBy: string | null;

  @Column({ name: 'lease_owner', type: 'text', nullable: true })
  leaseOwner: string | null;

  @Column({ name: 'lease_expiry', type: 'timestamptz', nullable: true })
  leaseExpiry: Date | null;

  /** last source object id processed (keyset), so a reclaimed run continues */
  @Column({ name: 'cursor', type: 'text', nullable: true })
  cursor: string | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;
}
