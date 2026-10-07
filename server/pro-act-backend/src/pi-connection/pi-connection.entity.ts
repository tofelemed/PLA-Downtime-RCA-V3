import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('pi_connections')
@Index(['tenantId'])
@Index(['organizationId'])
@Index(['createdAt'])
export class PIConnection {
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

  @ApiProperty({ description: 'Connection name' })
  @Column({ name: 'connection_name', type: 'varchar', length: 255 })
  connectionName: string;

  @ApiProperty({ description: 'PI Web API URL' })
  @Column({ name: 'pi_web_api_url', type: 'varchar', length: 500 })
  piWebApiUrl: string;

  @ApiProperty({ description: 'Username', required: false })
  @Column({ type: 'varchar', length: 255, nullable: true })
  username?: string;

  @ApiProperty({ description: 'Encrypted password', required: false })
  @Column({ name: 'password_encrypted', type: 'text', nullable: true })
  passwordEncrypted?: string;

  @ApiProperty({ description: 'AF Database path', required: false })
  @Column({ name: 'af_database_path', type: 'varchar', length: 500, nullable: true })
  afDatabasePath?: string;

  @ApiProperty({ description: 'Additional connection configuration as JSON', required: false })
  @Column({ name: 'connection_config', type: 'text', nullable: true })
  connectionConfig?: string;

  @ApiProperty({ description: 'Is active' })
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Last sync time', required: false })
  @Column({ name: 'last_sync_time', type: 'timestamptz', nullable: true })
  lastSyncTime?: Date;
}

