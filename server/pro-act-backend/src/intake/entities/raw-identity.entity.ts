import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Global delivery identity registry (plan 1.5 decision; spec DB03): `raw_observations` is partitioned
 * by receive time and cannot hold a unique key on the message id alone. The first delivery of a message
 * id registers here; repeats only bump `duplicate_count`.
 */
@Entity('raw_identities')
export class RawIdentity {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @PrimaryColumn({ name: 'connection_id', type: 'uuid' })
  connectionId: string;

  @PrimaryColumn({ name: 'message_id', type: 'text' })
  messageId: string;

  @Column({ name: 'raw_id', type: 'uuid' })
  rawId: string;

  @Column({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;

  @Column({ name: 'duplicate_count', type: 'int', default: 0 })
  duplicateCount: number;

  @Column({ name: 'last_duplicate_at', type: 'timestamptz', nullable: true })
  lastDuplicateAt: Date | null;
}
