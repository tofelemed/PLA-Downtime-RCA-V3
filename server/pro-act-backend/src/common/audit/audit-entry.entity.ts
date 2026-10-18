import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Append-only audit trail of domain commands (spec §14.2 `audit_log`, plan 2.8): actor (a user, or a named
 * service), action, entity and its revision, content hashes before / after, reason, correlation id, time
 * and a small detail document (e.g. the lifecycle `from` / `to`). UPDATE and DELETE are refused by a
 * trigger, except a retention delete of rows older than a declared cutoff (DB-07). The legacy request log `audit_logs` (global interceptor) is a different, mutable table.
 */
@Entity('audit_log')
@Index('IDX_audit_log_tenant_entity_at', [
  'tenantId',
  'entityType',
  'entityId',
  'at',
])
@Index('IDX_audit_log_at', ['at'])
/** RCA field history by case (partial expression index, migration RcaFieldHistory) */
@Index('IDX_audit_log_rca_case', { synchronize: false })
export class AuditEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ name: 'service', type: 'varchar', length: 64, nullable: true })
  service: string | null;

  @Column({ name: 'action', type: 'varchar', length: 64 })
  action: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 64 })
  entityType: string;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId: string;

  @Column({ name: 'revision', type: 'int', nullable: true })
  revision: number | null;

  @Column({ name: 'before_hash', type: 'varchar', length: 64, nullable: true })
  beforeHash: string | null;

  @Column({ name: 'after_hash', type: 'varchar', length: 64, nullable: true })
  afterHash: string | null;

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason: string | null;

  @Column({
    name: 'correlation_id',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  correlationId: string | null;

  @Column({ name: 'detail', type: 'jsonb', default: () => "'{}'" })
  detail: Record<string, unknown>;

  @CreateDateColumn({ name: 'at', type: 'timestamptz' })
  at: Date;
}
