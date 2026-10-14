import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('historian_tags')
@Index(['tenantId'])
@Index(['organizationId'])
@Index(['createdAt'])
@Index(['webId'])
@Index(['category'])
@Index(['enabled'])
export class HistorianTag {
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
  @Column({ name: 'organization_id', type: 'varchar', length: 36, nullable: true })
  organizationId?: string;

  @ApiProperty({ description: 'PI Web ID', required: false })
  @Column({ name: 'web_id', type: 'varchar', length: 255, nullable: true })
  webId?: string;

  @ApiProperty({ description: 'Tag name' })
  @Column({ name: 'tag_name', type: 'varchar', length: 255 })
  tagName: string;

  @ApiProperty({ description: 'Tag path', required: false })
  @Column({ name: 'tag_path', type: 'varchar', length: 1000, nullable: true })
  tagPath?: string;

  @ApiProperty({ description: 'Description', required: false })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @ApiProperty({ description: 'Category', required: false })
  @Column({ type: 'varchar', length: 100, nullable: true })
  category?: string;

  @ApiProperty({ description: 'Unit of measure', required: false })
  @Column({ name: 'unit_of_measure', type: 'varchar', length: 50, nullable: true })
  unitOfMeasure?: string;

  @ApiProperty({ description: 'Data type', required: false })
  @Column({ name: 'data_type', type: 'varchar', length: 50, nullable: true })
  dataType?: string;

  @ApiProperty({ description: 'Update interval in seconds', required: false })
  @Column({ name: 'update_interval', type: 'int', nullable: true })
  updateInterval?: number;

  @ApiProperty({ description: 'Warning threshold', required: false })
  @Column({ name: 'warning_threshold', type: 'float', nullable: true })
  warningThreshold?: number;

  @ApiProperty({ description: 'Alarm threshold', required: false })
  @Column({ name: 'alarm_threshold', type: 'float', nullable: true })
  alarmThreshold?: number;

  @ApiProperty({ description: 'Enabled' })
  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @ApiProperty({ description: 'Additional configuration JSON', required: false })
  @Column({ name: 'config', type: 'text', nullable: true })
  config?: string;
}

