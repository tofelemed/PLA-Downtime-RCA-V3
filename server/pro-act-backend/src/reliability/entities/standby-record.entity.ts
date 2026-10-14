import { Check, Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';

export const STANDBY_RECORD_KINDS = ['demand', 'test', 'run'] as const;
export type StandbyRecordKind = (typeof STANDBY_RECORD_KINDS)[number];

export const STANDBY_OUTCOMES = [
  'success',
  'failed_start',
  'failed_while_running',
] as const;
export type StandbyOutcome = (typeof STANDBY_OUTCOMES)[number];

/**
 * SME D9: one entry of a standby asset's demand / test log — a start demand (the duty unit tripped), a
 * proof test start, or a running period — with its outcome. Demands and tests are counted separately; a
 * run gives operating exposure. `external_ref` is the log's own id (an import replaces the same entry).
 */
@Entity('standby_records')
@Index('IDX_standby_records_tenant_asset_start', [
  'tenantId',
  'assetId',
  'startedAt',
])
@Index('UQ_standby_records_external_ref', ['tenantId', 'externalRef'], {
  unique: true,
  where: '"external_ref" IS NOT NULL',
})
@Check(
  'CHK_standby_records_interval',
  '"ended_at" IS NULL OR "ended_at" >= "started_at"',
)
@Check('CHK_standby_records_kind', `"record_kind" IN ('demand', 'test', 'run')`)
@Check(
  'CHK_standby_records_outcome',
  `"outcome" IN ('success', 'failed_start', 'failed_while_running') AND ("outcome" <> 'failed_while_running' OR "record_kind" = 'run') AND ("outcome" <> 'failed_start' OR "record_kind" <> 'run')`,
)
export class StandbyRecord extends TenantScopedEntity {
  @Column({ name: 'asset_id', type: 'uuid' })
  assetId: string;

  @Index('IDX_standby_records_unit')
  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @Column({ name: 'record_kind', type: 'varchar', length: 16 })
  recordKind: StandbyRecordKind;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  /** end of a run; demands and tests may carry how long the start attempt lasted */
  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt: Date | null;

  @Column({ name: 'outcome', type: 'varchar', length: 24 })
  outcome: StandbyOutcome;

  /** the stop of the duty equipment that caused the demand, when known */
  @Column({ name: 'event_id', type: 'uuid', nullable: true })
  eventId: string | null;

  @Column({
    name: 'external_ref',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  externalRef: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;
}
