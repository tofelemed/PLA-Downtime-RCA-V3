import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('pi_sync_watermarks')
@Index(['tenantId'])
@Index(['organizationId'])
@Index(['createdAt'])
export class PISyncWatermark {
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
  @Column({ name: 'tenant_id', type: 'varchar', length: 36, nullable: true })
  tenantId?: string;

  @ApiProperty({ description: 'Organization ID', required: false })
  @Column({ name: 'organization_id', type: 'varchar', length: 36, nullable: true })
  organizationId?: string;

  @ApiProperty({ description: 'Sync type', required: false })
  @Column({ name: 'sync_type', type: 'varchar', length: 100, nullable: true })
  syncType?: string;

  @ApiProperty({ description: 'Last sync timestamp', required: false })
  @Column({ name: 'last_sync_timestamp', type: 'timestamptz', nullable: true })
  lastSyncTimestamp?: Date;

  @ApiProperty({ description: 'Last sync marker', required: false })
  @Column({ name: 'last_sync_marker', type: 'varchar', length: 255, nullable: true })
  lastSyncMarker?: string;

  @ApiProperty({ description: 'Sync status', required: false })
  @Column({ name: 'sync_status', type: 'varchar', length: 50, nullable: true })
  syncStatus?: string;
}

