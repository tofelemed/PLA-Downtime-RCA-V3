import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';

export const INGESTION_ERROR_CODES = [
  'unknown_template',
  'unknown_code',
  'unknown_unit',
  'mapping_ambiguous',
  'mapping_invalid_target',
  'schema_invalid',
  'unit_conflict',
  'duration_conflict',
  'order_conflict',
  'no_handler',
  'processing_failed',
] as const;
export type IngestionErrorCode = (typeof INGESTION_ERROR_CODES)[number];

export const INGESTION_EXCEPTION_STATES = [
  'open',
  'resolved',
  'irrecoverable',
] as const;
export type IngestionExceptionState =
  (typeof INGESTION_EXCEPTION_STATES)[number];

/**
 * Quarantine (spec ING05, §14.2 `ingestion_exceptions`): a delivery that could not become canonical
 * data, with the raw record it came from. One open row per source object and error code; repeats bump
 * `occurrences`/`last_seen`. Resolution = fix the mapping, then replay (the replay resolves the row).
 */
@Entity('ingestion_exceptions')
@Index(
  'UQ_ingestion_exceptions_open_object_code',
  ['tenantId', 'connectionId', 'sourceObjectId', 'errorCode'],
  { unique: true, where: `"state" = 'open'` },
)
@Index('IDX_ingestion_exceptions_tenant_state_last_seen', [
  'tenantId',
  'state',
  'lastSeen',
])
export class IngestionException extends TenantScopedEntity {
  @Column({ name: 'connection_id', type: 'uuid' })
  connectionId: string;

  @Column({ name: 'source_object_id', type: 'text' })
  sourceObjectId: string;

  /** latest raw delivery that hit the error */
  @Column({ name: 'raw_id', type: 'uuid' })
  rawId: string;

  @Column({ name: 'raw_received_at', type: 'timestamptz' })
  rawReceivedAt: Date;

  @Column({
    name: 'error_code',
    type: 'enum',
    enum: INGESTION_ERROR_CODES,
    enumName: 'ingestion_error_code',
  })
  errorCode: IngestionErrorCode;

  /** reason, candidates, diagnostics, violations (never secrets) */
  @Column({ name: 'detail', type: 'jsonb', default: () => "'{}'" })
  detail: Record<string, unknown>;

  @Column({
    name: 'state',
    type: 'enum',
    enum: INGESTION_EXCEPTION_STATES,
    enumName: 'ingestion_exception_state',
    default: 'open',
  })
  state: IngestionExceptionState;

  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  ownerId: string | null;

  @Column({ name: 'first_seen', type: 'timestamptz' })
  firstSeen: Date;

  @Column({ name: 'last_seen', type: 'timestamptz' })
  lastSeen: Date;

  @Column({ name: 'occurrences', type: 'int', default: 1 })
  occurrences: number;

  @Column({ name: 'resolution', type: 'jsonb', nullable: true })
  resolution: Record<string, unknown> | null;

  /** replay that resolved (or is resolving) the row */
  @Column({ name: 'replay_run_id', type: 'uuid', nullable: true })
  replayRunId: string | null;
}
