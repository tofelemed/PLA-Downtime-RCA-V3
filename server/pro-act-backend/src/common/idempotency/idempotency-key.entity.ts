import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/**
 * Stored outcome of an `@Idempotent()` command (API02): the same key with the same request hash
 * replays the stored response; a different hash is a 409. Rows expire after 24 h and are purged by
 * `IdempotencyCleanupJob` in the worker.
 */
@Entity('idempotency_keys')
export class IdempotencyKey {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @PrimaryColumn({ name: 'key', type: 'varchar', length: 255 })
  key: string;

  /** sha256 of method, path and canonical JSON body */
  @Column({ name: 'request_hash', type: 'varchar', length: 64 })
  requestHash: string;

  @Column({ name: 'response_status', type: 'int' })
  responseStatus: number;

  @Column({ name: 'response_body', type: 'jsonb', nullable: true })
  responseBody: unknown;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Index('IDX_idempotency_keys_expires_at')
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
}
