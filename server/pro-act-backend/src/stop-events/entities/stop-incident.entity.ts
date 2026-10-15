import { Check, Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';

/**
 * SME D5 / S3: repeat stops of one asset and reason within the merge window, grouped under one unresolved
 * incident. The stops stay separate events with their own durations; MTBF-style counts count the incident
 * once (KPI 2.7.8). Identified by its first occurrence, so regrouping after late changes keeps the row;
 * the members are `stop_incident_members`. Recomputed by the worker; a person breaks a chain with
 * `stop_incident_breaks` (a verified repair before a stop).
 */
@Entity('stop_incidents')
@Index(
  'UQ_stop_incidents_first_occurrence',
  ['tenantId', 'firstOccurrenceId'],
  {
    unique: true,
  },
)
@Index('IDX_stop_incidents_tenant_unit_start', [
  'tenantId',
  'unitId',
  'startTime',
])
@Check(
  'CHK_stop_incidents_interval',
  '"end_time" IS NULL OR "end_time" >= "start_time"',
)
@Check('CHK_stop_incidents_count', '"stop_count" >= 2')
export class StopIncident extends TenantScopedEntity {
  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @Column({ name: 'asset_id', type: 'uuid', nullable: true })
  assetId: string | null;

  /** the shared reason (failure mode) of the repeats */
  @Column({ name: 'reason_code_id', type: 'uuid' })
  reasonCodeId: string;

  @Column({ name: 'first_occurrence_id', type: 'uuid' })
  firstOccurrenceId: string;

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime: Date;

  /** null while the last stop is open */
  @Column({ name: 'end_time', type: 'timestamptz', nullable: true })
  endTime: Date | null;

  @Column({ name: 'stop_count', type: 'int' })
  stopCount: number;

  /** physical stopped seconds of the closed stops (S3: never the incident envelope) */
  @Column({ name: 'stopped_seconds', type: 'numeric', precision: 18, scale: 3 })
  stoppedSeconds: number;

  /** the merge window the grouping used */
  @Column({ name: 'window_seconds', type: 'int' })
  windowSeconds: number;

  @Column({ name: 'policy_version_id', type: 'uuid', nullable: true })
  policyVersionId: string | null;
}
