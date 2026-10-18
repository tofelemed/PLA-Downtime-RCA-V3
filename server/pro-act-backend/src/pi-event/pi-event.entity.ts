import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('pi_events')
@Index(['tenantId'])
@Index(['organizationId'])
@Index(['createdAt'])
@Index(['template'])
@Index(['primaryAfId'])
@Index(['startUtc'])
export class PIEvent {
  @ApiProperty({ description: 'Primary key UUID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ApiProperty({ description: 'Tenant ID for multi-tenancy', required: false })
  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant;

  @ApiProperty({ description: 'Organization ID', required: false })
  @Column({
    name: 'organization_id',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  organizationId?: string;

  @ApiProperty({ description: 'PI Web ID', required: false })
  @Column({ name: 'web_id', type: 'varchar', length: 255, nullable: true })
  webId?: string;

  @ApiProperty({ description: 'Event name', required: false })
  @Column({ type: 'varchar', length: 255, nullable: true })
  name?: string;

  @ApiProperty({ description: 'Template name', required: false })
  @Column({ type: 'varchar', length: 255, nullable: true })
  template?: string;

  @ApiProperty({ description: 'Primary AF ID', required: false })
  @Column({
    name: 'primary_af_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  primaryAfId?: string;

  @ApiProperty({ description: 'Start time UTC', required: false })
  @Column({ name: 'start_utc', type: 'timestamptz', nullable: true })
  startUtc?: Date;

  @ApiProperty({ description: 'End time UTC', required: false })
  @Column({ name: 'end_utc', type: 'timestamptz', nullable: true })
  endUtc?: Date;

  @ApiProperty({ description: 'Acknowledged' })
  @Column({ type: 'boolean', default: false })
  acknowledged: boolean;

  @ApiProperty({ description: 'Event data as JSON', required: false })
  @Column({ name: 'event_data', type: 'text', nullable: true })
  eventData?: string;
}
