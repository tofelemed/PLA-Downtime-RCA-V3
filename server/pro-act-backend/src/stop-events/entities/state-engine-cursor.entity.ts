import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';

/**
 * Plan 1.10 state engine progress per unit: derived stops are up to date through `processed_through`
 * for the mapping version `mapping_id`, with every sample stored up to `samples_seen_through`
 * (`measurement_samples.inserted_at`). A later-stored sample with an earlier observation time (late
 * sample) or a new mapping version reopens the window from that time (idempotent reprocessing).
 */
@Entity('state_engine_cursors')
@Index('UQ_state_engine_cursors_unit', ['tenantId', 'unitId'], { unique: true })
export class StateEngineCursor extends TenantScopedEntity {
  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @Column({ name: 'mapping_id', type: 'uuid' })
  mappingId: string;

  @Column({ name: 'processed_through', type: 'timestamptz' })
  processedThrough: Date;

  @Column({ name: 'samples_seen_through', type: 'timestamptz' })
  samplesSeenThrough: Date;
}
