import { Column, Entity, Index, Unique } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';

export const SOURCE_OBJECT_STATES = [
  'active',
  'retracted',
  'deleted_confirmed',
] as const;
export type SourceObjectState = (typeof SOURCE_OBJECT_STATES)[number];

/**
 * Logical source identity (spec §5.1, §14.2 `source_objects`): tenant + connection + source object id.
 * Holds the latest accepted version (hash, revision, observation time) so redeliveries are recognised
 * and out-of-order versions never overwrite newer ones, plus the canonical event it normalised into.
 * `normalized_raw_id` = the raw row the canonical state was last built from (null or older than
 * `latest_raw_id` while a version waits in quarantine).
 */
@Entity('source_objects')
@Unique('UQ_source_objects_identity', [
  'tenantId',
  'connectionId',
  'sourceObjectId',
])
@Index('IDX_source_objects_tenant_connection_observed', [
  'tenantId',
  'connectionId',
  'latestObservedAt',
])
@Index('IDX_source_objects_canonical_event', ['canonicalEventId'])
export class SourceObject extends TenantScopedEntity {
  @Column({ name: 'connection_id', type: 'uuid' })
  connectionId: string;

  @Column({ name: 'source_object_id', type: 'text' })
  sourceObjectId: string;

  @Column({ name: 'kind', type: 'varchar', length: 32 })
  kind: string;

  @Column({ name: 'canonical_event_id', type: 'uuid', nullable: true })
  canonicalEventId: string | null;

  /** measurement/state objects (plans 1.7, 1.10) */
  @Column({ name: 'signal_id', type: 'uuid', nullable: true })
  signalId: string | null;

  @Column({ name: 'latest_raw_id', type: 'uuid' })
  latestRawId: string;

  @Column({ name: 'latest_received_at', type: 'timestamptz' })
  latestReceivedAt: Date;

  @Column({ name: 'latest_revision', type: 'text', nullable: true })
  latestRevision: string | null;

  @Column({ name: 'latest_hash', type: 'text' })
  latestHash: string;

  @Column({ name: 'latest_observed_at', type: 'timestamptz' })
  latestObservedAt: Date;

  @Column({ name: 'normalized_raw_id', type: 'uuid', nullable: true })
  normalizedRawId: string | null;

  @Column({ name: 'first_seen', type: 'timestamptz' })
  firstSeen: Date;

  @Column({ name: 'last_seen', type: 'timestamptz' })
  lastSeen: Date;

  @Column({
    name: 'state',
    type: 'enum',
    enum: SOURCE_OBJECT_STATES,
    enumName: 'source_object_state',
    default: 'active',
  })
  state: SourceObjectState;
}
