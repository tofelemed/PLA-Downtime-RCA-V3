import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

export const RAW_OUTCOMES = [
  'accepted',
  'revision',
  'duplicate_content',
  'stale',
  'conflict',
  'invalid',
  'replayed',
] as const;
/** What intake decided for this delivery (see `source-object-ordering.ts`). */
export type RawOutcome = (typeof RAW_OUTCOMES)[number];

/**
 * Immutable raw store (spec FND01, §14.2 `raw_observations`): every delivery that is not a repeated
 * message id is kept before the source is acknowledged or the cursor moves. Range-partitioned by
 * `received_at` (monthly, maintained by `RawPartitionMaintenanceJob`), so the primary key includes it;
 * global delivery uniqueness lives in `raw_identities`. Rows are never updated or deleted (trigger);
 * retention drops whole partitions.
 */
@Entity('raw_observations')
@Index('IDX_raw_observations_tenant_object_received', [
  'tenantId',
  'sourceObjectId',
  'receivedAt',
])
@Index('IDX_raw_observations_tenant_connection_received', [
  'tenantId',
  'connectionId',
  'receivedAt',
])
@Index('IDX_raw_observations_replay_run', ['replayRunId'])
export class RawObservation {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @PrimaryColumn({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'connection_id', type: 'uuid' })
  connectionId: string;

  @Column({ name: 'message_id', type: 'text' })
  messageId: string;

  @Column({ name: 'source_object_id', type: 'text' })
  sourceObjectId: string;

  @Column({ name: 'source_revision', type: 'text', nullable: true })
  sourceRevision: string | null;

  /** hash of the business content (no delivery fields) */
  @Column({ name: 'content_hash', type: 'text' })
  contentHash: string;

  /** null when the envelope failed schema validation */
  @Column({ name: 'kind', type: 'varchar', length: 32, nullable: true })
  kind: string | null;

  @Column({ name: 'operation', type: 'varchar', length: 16, nullable: true })
  operation: string | null;

  /** event time at the source (FND04) */
  @Column({ name: 'event_time', type: 'timestamptz', nullable: true })
  eventTime: Date | null;

  /** the whole envelope as delivered */
  @Column({ name: 'payload', type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  /** object-store reference for payloads above the inline limit (KF04) */
  @Column({ name: 'payload_ref', type: 'text', nullable: true })
  payloadRef: string | null;

  @Column({ name: 'payload_size', type: 'int' })
  payloadSize: number;

  @Column({ name: 'quality', type: 'jsonb', nullable: true })
  quality: Record<string, unknown> | null;

  @Column({ name: 'source_cursor', type: 'jsonb', nullable: true })
  sourceCursor: Record<string, unknown> | null;

  @Column({ name: 'mapping_version', type: 'int', default: 0 })
  mappingVersion: number;

  @Column({ name: 'correlation_id', type: 'text', nullable: true })
  correlationId: string | null;

  @Column({ name: 'replay_run_id', type: 'uuid', nullable: true })
  replayRunId: string | null;

  /** replays: the first delivery of the same message id (lineage) */
  @Column({ name: 'original_raw_id', type: 'uuid', nullable: true })
  originalRawId: string | null;

  @Column({
    name: 'outcome',
    type: 'enum',
    enum: RAW_OUTCOMES,
    enumName: 'raw_observation_outcome',
  })
  outcome: RawOutcome;
}
