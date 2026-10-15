import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('rca_analysis_configs')
@Index(['tenantId'])
@Index(['organizationId'])
@Index(['createdAt'])
export class RCAAnalysisConfig {
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

  // Note: Database schema has: analysis_type, config_name, config_data, is_default
  // The entity structure doesn't match - all config fields should be stored in config_data JSON
  @ApiProperty({ description: 'Analysis type', required: false })
  @Column({ name: 'analysis_type', type: 'varchar', length: 100, nullable: true })
  analysisType?: string;

  @ApiProperty({ description: 'Configuration name' })
  @Column({ name: 'config_name', type: 'varchar', length: 255, nullable: true })
  name: string;

  // Note: Database schema doesn't have separate columns for these - they should be in config_data
  // @ApiProperty({ description: 'Configuration description', required: false })
  // @Column({ name: 'description', type: 'text', nullable: true })
  // description?: string;

  // Note: Database schema has 'is_default', but we map it to isActive for application logic
  @ApiProperty({ description: 'Whether this configuration is active', default: true })
  @Column({ name: 'is_default', type: 'boolean', default: true })
  isActive: boolean;

  // Note: These fields don't exist as separate columns - they should be stored in config_data JSON
  // @ApiProperty({ description: 'Enabled analysis tools', required: false })
  // @Column({ name: 'enabled_tools', type: 'simple-json', nullable: true })
  // enabledTools?: Record<string, boolean>;

  // @ApiProperty({ description: 'Five Why configuration', required: false })
  // @Column({ name: 'five_why_config', type: 'simple-json', nullable: true })
  // fiveWhyConfig?: Record<string, any>;

  // @ApiProperty({ description: 'Fishbone configuration', required: false })
  // @Column({ name: 'fishbone_config', type: 'simple-json', nullable: true })
  // fishboneConfig?: Record<string, any>;

  // @ApiProperty({ description: 'FMEA configuration', required: false })
  // @Column({ name: 'fmea_config', type: 'simple-json', nullable: true })
  // fmeaConfig?: Record<string, any>;

  // @ApiProperty({ description: 'Fault tree configuration', required: false })
  // @Column({ name: 'fault_tree_config', type: 'simple-json', nullable: true })
  // faultTreeConfig?: Record<string, any>;

  // @ApiProperty({ description: 'Knowledge base configuration', required: false })
  // @Column({ name: 'knowledge_base_config', type: 'simple-json', nullable: true })
  // knowledgeBaseConfig?: Record<string, any>;

  // Note: Database schema doesn't have 'required_fields' column
  // @ApiProperty({ description: 'Required field configuration', required: false })
  // @Column({ name: 'required_fields', type: 'simple-json', nullable: true })
  // requiredFields?: Record<string, any>;

  @ApiProperty({ description: 'Legacy configuration payload for backward compatibility', required: false })
  @Column({ name: 'config_data', type: 'text', nullable: true })
  legacyConfigData?: string;
}

