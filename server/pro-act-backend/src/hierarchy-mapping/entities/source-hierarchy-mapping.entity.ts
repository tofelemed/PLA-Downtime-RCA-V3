import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export type SourceType = 'PI' | 'OPCUA' | 'Modbus' | 'MQTT' | 'Database' | 'RESTAPI' | 'SystemIntegration' | '*';
export type TargetType = 'unit' | 'asset' | 'tenant' | 'organization';

@Entity('source_hierarchy_mappings')
@Index(['tenantId'])
@Index(['sourceType'])
@Index(['targetType'])
@Index(['sourceIdentifier'])
@Index(['pattern'])
@Index(['priority'])
@Index(['isActive'])
export class SourceHierarchyMapping {
  @ApiProperty({ description: 'Primary key UUID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Source type (PI, OPCUA, Modbus, MQTT, etc.) or "*" for all sources' })
  @Column({ name: 'source_type', type: 'varchar', length: 50 })
  sourceType: SourceType;

  @ApiProperty({ description: 'Optional: specific connection ID', required: false })
  @Column({ name: 'source_connection_id', type: 'uuid', nullable: true })
  sourceConnectionId?: string;

  @ApiProperty({ description: 'External source identifier (WebId, NodeId, Topic, Register, etc.)' })
  @Column({ name: 'source_identifier', type: 'varchar', length: 1000 })
  sourceIdentifier: string;

  @ApiProperty({ description: 'Optional: hierarchical path in source system', required: false })
  @Column({ name: 'source_path', type: 'varchar', length: 1000, nullable: true })
  sourcePath?: string;

  @ApiProperty({ description: 'Target hierarchy level (unit, asset, tenant)' })
  @Column({ name: 'target_type', type: 'varchar', length: 50 })
  targetType: TargetType;

  @ApiProperty({ description: 'Target hierarchy ID (Unit ID, Asset ID, or Tenant ID)' })
  @Column({ name: 'target_id', type: 'uuid' })
  targetId: string;

  @ApiProperty({ description: 'Tenant ID for multi-tenancy' })
  @Column({ name: 'tenant_id', type: 'varchar', length: 36 })
  tenantId: string;

  @ApiProperty({ description: 'Organization ID', required: false })
  @Column({ name: 'organization_id', type: 'varchar', length: 36, nullable: true })
  organizationId?: string;

  @ApiProperty({ description: 'Is this a pattern rule?', required: false, default: false })
  @Column({ name: 'is_pattern', type: 'boolean', default: false })
  isPattern: boolean;

  @ApiProperty({ description: 'Pattern expression (e.g., "PI\\\\Plant1\\\\Line1\\\\*")', required: false })
  @Column({ name: 'pattern', type: 'varchar', length: 500, nullable: true })
  pattern?: string;

  @ApiProperty({ description: 'Priority for matching (higher = checked first)', required: false, default: 50 })
  @Column({ name: 'priority', type: 'int', default: 50 })
  priority: number;

  @ApiProperty({ description: 'Is this mapping active?', required: false, default: true })
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Description of this mapping', required: false })
  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

