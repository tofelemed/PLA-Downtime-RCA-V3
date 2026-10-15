import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantOwnedEntity } from '../../common/entities/tenant-scoped.entity';
import { StopIncident } from './stop-incident.entity';

/** A stop occurrence of a repeat-stop incident (SME D5); an occurrence belongs to one incident at most. */
@Entity('stop_incident_members')
@Index('UQ_stop_incident_members_occurrence', ['tenantId', 'occurrenceId'], {
  unique: true,
})
@Index('IDX_stop_incident_members_incident', ['incidentId'])
export class StopIncidentMember extends TenantOwnedEntity {
  @Column({ name: 'incident_id', type: 'uuid' })
  incidentId: string;

  @ManyToOne(() => StopIncident, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'incident_id',
    foreignKeyConstraintName: 'FK_stop_incident_members_incident',
  })
  incident?: StopIncident;

  @Column({ name: 'occurrence_id', type: 'uuid' })
  occurrenceId: string;
}
