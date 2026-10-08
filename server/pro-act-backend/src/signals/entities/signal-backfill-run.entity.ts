import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { Signal } from './signal.entity';

export const BACKFILL_STATES = [
  'queued',
  'running',
  'completed',
  'failed',
] as const;
export type BackfillState = (typeof BACKFILL_STATES)[number];

/** Why a backfill ran: a user request, or a lost stream-updates marker (PI08). */
export const BACKFILL_REASONS = ['requested', 'marker_lost'] as const;
export type BackfillReason = (typeof BACKFILL_REASONS)[number];

/**
 * A bounded historical re-read of one signal (spec §14.2 `signal_backfill_runs`, PI08): `[from, to)` is
 * read through a leased `backfill` ingestion job (`ingestion_job_id`) and every value goes through intake
 * like a poll (duplicates are recognised, corrections become revisions).
 */
@Entity('signal_backfill_runs')
@Index('IDX_signal_backfill_runs_tenant_signal_created', [
  'tenantId',
  'signalId',
  'createdAt',
])
@Index('IDX_signal_backfill_runs_job', ['ingestionJobId'])
@Check('CHK_signal_backfill_runs_interval', '"to_time" > "from_time"')
export class SignalBackfillRun extends TenantScopedEntity {
  @Column({ name: 'signal_id', type: 'uuid' })
  signalId: string;

  @ManyToOne(() => Signal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'signal_id' })
  signal?: Signal;

  @Column({ name: 'from_time', type: 'timestamptz' })
  fromTime: Date;

  @Column({ name: 'to_time', type: 'timestamptz' })
  toTime: Date;

  @Column({
    name: 'state',
    type: 'enum',
    enum: BACKFILL_STATES,
    enumName: 'signal_backfill_state',
    default: 'queued',
  })
  state: BackfillState;

  @Column({ name: 'reason', type: 'varchar', length: 32 })
  reason: BackfillReason;

  @Column({ name: 'ingestion_job_id', type: 'uuid', nullable: true })
  ingestionJobId: string | null;

  @Column({ name: 'detail', type: 'jsonb', nullable: true })
  detail: Record<string, unknown> | null;
}
