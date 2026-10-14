import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('data_sources')
@Index(['tenantId'])
@Index(['organizationId'])
@Index(['createdAt'])
@Index(['type'])
@Index(['status'])
@Index(['enabled'])
export class DataSource {
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

  @ApiProperty({ description: 'Source name' })
  @Column({ name: 'source_name', type: 'varchar', length: 255 })
  sourceName: string;

  @ApiProperty({ description: 'Source type', required: false })
  @Column({ type: 'varchar', length: 100, nullable: true })
  type?: string;

  @ApiProperty({ description: 'Connection string', required: false })
  @Column({ name: 'connection_string', type: 'text', nullable: true })
  connectionString?: string;

  @ApiProperty({ description: 'Encrypted credentials', required: false })
  @Column({ name: 'credentials_encrypted', type: 'text', nullable: true })
  credentialsEncrypted?: string;

  @ApiProperty({ description: 'Status', required: false })
  @Column({ type: 'varchar', length: 50, nullable: true })
  status?: string;

  @ApiProperty({ description: 'Enabled' })
  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @ApiProperty({ description: 'Last sync time', required: false })
  @Column({ name: 'last_sync_time', type: 'timestamptz', nullable: true })
  lastSyncTime?: Date;

  @ApiProperty({ description: 'Configuration as JSON', required: false })
  @Column({ type: 'text', nullable: true })
  config?: string;
}

