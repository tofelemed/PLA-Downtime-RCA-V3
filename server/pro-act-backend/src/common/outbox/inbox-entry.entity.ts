import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Consumer inbox (spec FND02, T10, §14.2 `inbox`): one row per delivery key a consumer has taken. The
 * key is inserted in the consumer's transaction, so a redelivered message finds it and has no second
 * effect.
 */
@Entity('inbox')
@Index('IDX_inbox_tenant_scope_received', ['tenantId', 'scope', 'receivedAt'])
export class InboxEntry {
  /** consumer-defined, e.g. `normalize:<raw id>` or `<consumer>:<outbox id>` */
  @PrimaryColumn({ name: 'delivery_key', type: 'text' })
  deliveryKey: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  /** consumer name */
  @Column({ name: 'scope', type: 'varchar', length: 64 })
  scope: string;

  /** message type */
  @Column({ name: 'type', type: 'varchar', length: 64 })
  type: string;

  @Column({ name: 'received_at', type: 'timestamptz', default: () => 'now()' })
  receivedAt: Date;

  /** processing time (FND04) */
  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;
}
