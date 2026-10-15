import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';

/**
 * SME D5: "distinct verified repairs followed by new failures remain separate" — a person marks a stop
 * occurrence as a new failure, so the incident grouping never joins it to the stop before it. Deleting
 * the row (undo) lets the grouping join it again.
 */
@Entity('stop_incident_breaks')
@Index('UQ_stop_incident_breaks_occurrence', ['tenantId', 'occurrenceId'], {
  unique: true,
})
export class StopIncidentBreak extends TenantScopedEntity {
  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @Column({ name: 'occurrence_id', type: 'uuid' })
  occurrenceId: string;

  @Column({ name: 'reason', type: 'text' })
  reason: string;
}
