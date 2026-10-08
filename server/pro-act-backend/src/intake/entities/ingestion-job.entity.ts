import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { IntegrationConnection } from './integration-connection.entity';

export const INGESTION_JOB_STATES = [
  'created',
  'running',
  'paused',
  'draining',
  'stopped',
  'failed',
] as const;
export type IngestionJobState = (typeof INGESTION_JOB_STATES)[number];

/** How often a polling job reads; streaming adapters ignore it. */
export interface JobCadence {
  intervalSeconds: number;
  /** records per page handed to the adapter */
  pageSize?: number;
}

/**
 * A leased intake job (spec ING02, API04, §14.2 `ingestion_jobs`): one scope of one connection. `state`
 * is the requested lifecycle; `lease_owner`/`lease_expiry` say which worker holds it right now. The
 * cursor is committed only after every record of a page is durably accepted or quarantined (FND01).
 * At most one non-stopped job per connection and scope.
 */
@Entity('ingestion_jobs')
@Index(
  'UQ_ingestion_jobs_connection_scope_active',
  ['connectionId', 'scopeHash'],
  {
    unique: true,
    where: `"state" <> 'stopped'`,
  },
)
@Index('IDX_ingestion_jobs_state_next_run', ['state', 'nextRunAt'])
@Index('IDX_ingestion_jobs_tenant_connection', ['tenantId', 'connectionId'])
export class IngestionJob extends TenantScopedEntity {
  @Column({ name: 'connection_id', type: 'uuid' })
  connectionId: string;

  @ManyToOne(() => IntegrationConnection, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'connection_id' })
  connection?: IntegrationConnection;

  /** templates, elements, topics ... (adapter-specific) */
  @Column({ name: 'scope', type: 'jsonb', default: () => "'{}'" })
  scope: Record<string, unknown>;

  /** sha256 of the canonical scope JSON */
  @Column({ name: 'scope_hash', type: 'varchar', length: 64 })
  scopeHash: string;

  @Column({
    name: 'state',
    type: 'enum',
    enum: INGESTION_JOB_STATES,
    enumName: 'ingestion_job_state',
    default: 'created',
  })
  state: IngestionJobState;

  @Column({ name: 'lease_owner', type: 'text', nullable: true })
  leaseOwner: string | null;

  @Column({ name: 'lease_expiry', type: 'timestamptz', nullable: true })
  leaseExpiry: Date | null;

  @Column({ name: 'heartbeat_at', type: 'timestamptz', nullable: true })
  heartbeatAt: Date | null;

  @Column({ name: 'committed_cursor', type: 'jsonb', nullable: true })
  committedCursor: Record<string, unknown> | null;

  @Column({ name: 'last_observation_at', type: 'timestamptz', nullable: true })
  lastObservationAt: Date | null;

  @Column({ name: 'last_success_at', type: 'timestamptz', nullable: true })
  lastSuccessAt: Date | null;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @Column({
    name: 'cadence',
    type: 'jsonb',
    default: () => `'{"intervalSeconds": 60}'`,
  })
  cadence: JobCadence;

  /** recovery policy (backfill window on restart ...), adapter-specific */
  @Column({ name: 'recovery', type: 'jsonb', nullable: true })
  recovery: Record<string, unknown> | null;

  @Column({ name: 'next_run_at', type: 'timestamptz', default: () => 'now()' })
  nextRunAt: Date;

  /** counters of the last page: accepted, duplicates, quarantined ... */
  @Column({ name: 'health', type: 'jsonb', default: () => "'{}'" })
  health: Record<string, number>;
}
