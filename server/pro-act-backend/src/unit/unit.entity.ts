import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Site } from '../calendar/entities/site.entity';

@Entity('units')
@Unique('UQ_units_tenant_code', ['tenantId', 'code'])
export class Unit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'capacity', type: 'decimal', precision: 15, scale: 4, nullable: true })
  capacity?: number;

  @Column({ name: 'unit_of_measure', type: 'varchar', length: 50, nullable: true })
  unitOfMeasure?: string;

  @Column({ name: 'ideal_cycle_time', type: 'decimal', precision: 10, scale: 2, nullable: true })
  idealCycleTime?: number;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId?: string;

  /** Site of the unit (plan 2.1); null = the tenant's default site */
  @Index('IDX_units_site_id')
  @Column({ name: 'site_id', type: 'uuid', nullable: true })
  siteId?: string | null;

  @ManyToOne(() => Site, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'site_id' })
  site?: Site | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
} 