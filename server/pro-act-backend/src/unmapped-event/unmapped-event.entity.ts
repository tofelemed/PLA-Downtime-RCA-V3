import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';

@Entity('unmapped_events')
export class UnmappedEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant;

  @Column({ name: 'organization_id', type: 'varchar', length: 36, nullable: true })
  organizationId?: string;

  @Column({ name: 'unit_id', type: 'varchar', length: 36, nullable: true })
  unitId?: string;

  @Column({ name: 'event_name', type: 'varchar', length: 255, nullable: true })
  eventName?: string;

  @Column({ name: 'event_type', type: 'varchar', length: 100, nullable: true })
  eventType?: string;

  @Column({ name: 'start_time', type: 'timestamptz', nullable: true })
  startTime?: Date;

  @Column({ name: 'end_time', type: 'timestamptz', nullable: true })
  endTime?: Date;

  @Column({ name: 'source_system', type: 'varchar', length: 100, nullable: true })
  sourceSystem?: string;

  @Column({ name: 'source_id', type: 'varchar', length: 255, nullable: true })
  sourceId?: string;

  /** JSON payload: reason, suggestions, event snapshot, PI attributes, etc. */
  @Column({ name: 'event_data', type: 'text', nullable: true })
  eventData?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
