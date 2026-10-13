import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export const OUTBOX_STATES = ['pending', 'published', 'failed'] as const;
export type OutboxState = (typeof OUTBOX_STATES)[number];

/**
 * Transactional outbox (spec FND02, API05, §14.2 `outbox`): a domain change and its message are
 * committed together; the relay publishes pending rows afterwards (at least once, each id once per
 * successful publish). `id` is a bigint sequence so the relay preserves commit order per aggregate.
 */
@Entity('outbox')
/** the relay's poll: pending rows only, so published history never bloats it (DB-07) */
@Index('IDX_outbox_pending_next_attempt', ['nextAttemptAt', 'id'], {
  where: `"state" = 'pending'`,
})
@Index('IDX_outbox_tenant_aggregate', [
  'tenantId',
  'aggregateType',
  'aggregateId',
])
export class OutboxMessage {
  /** bigint as string (pg returns int8 as text) */
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'aggregate_type', type: 'varchar', length: 64 })
  aggregateType: string;

  @Column({ name: 'aggregate_id', type: 'varchar', length: 128 })
  aggregateId: string;

  /** message type, e.g. `EventChanged`, `RawAccepted` */
  @Column({ name: 'type', type: 'varchar', length: 64 })
  type: string;

  /** aggregate version the message describes (event revision, raw id sequence ...) */
  @Column({ name: 'version', type: 'int', default: 0 })
  version: number;

  @Column({ name: 'payload', type: 'jsonb' })
  payload: Record<string, unknown>;

  /** routing scope (e.g. unit id or connection id); null = tenant-wide */
  @Column({ name: 'scope', type: 'varchar', length: 128, nullable: true })
  scope: string | null;

  @Column({
    name: 'state',
    type: 'enum',
    enum: OUTBOX_STATES,
    enumName: 'outbox_state',
    default: 'pending',
  })
  state: OutboxState;

  @Column({ name: 'attempts', type: 'int', default: 0 })
  attempts: number;

  @Column({
    name: 'next_attempt_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  nextAttemptAt: Date;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;
}
