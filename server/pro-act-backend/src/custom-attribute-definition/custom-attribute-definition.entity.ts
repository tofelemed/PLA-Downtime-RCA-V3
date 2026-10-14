import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('custom_attribute_definitions')
@Index(['entityType'])
@Index(['tenantId'])
@Index(['organizationId'])
@Index(['createdAt'])
export class CustomAttributeDefinition {
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

  @ApiProperty({ description: 'Entity type' })
  @Column({ name: 'entity_type', type: 'varchar', length: 100 })
  entityType: string;

  @ApiProperty({ description: 'Attribute name' })
  @Column({ name: 'attribute_name', type: 'varchar', length: 255 })
  attributeName: string;

  @ApiProperty({ description: 'Display name', required: false })
  @Column({ name: 'display_name', type: 'varchar', length: 255, nullable: true })
  displayName?: string;

  @ApiProperty({ description: 'Description', required: false })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @ApiProperty({ description: 'Data type', required: false })
  @Column({ name: 'data_type', type: 'varchar', length: 50, nullable: true })
  dataType?: string;

  @ApiProperty({ description: 'Is required' })
  @Column({ name: 'is_required', type: 'boolean', default: false })
  isRequired: boolean;

  @ApiProperty({ description: 'Default value', required: false })
  @Column({ name: 'default_value', type: 'text', nullable: true })
  defaultValue?: string;

  @ApiProperty({ description: 'Validation rules as JSON', required: false })
  @Column({ name: 'validation_rules', type: 'text', nullable: true })
  validationRules?: string;

  @ApiProperty({ description: 'Select options as JSON', required: false })
  @Column({ name: 'select_options', type: 'text', nullable: true })
  selectOptions?: string;

  @ApiProperty({ description: 'Display order', required: false })
  @Column({ name: 'display_order', type: 'int', nullable: true })
  displayOrder?: number;

  @ApiProperty({ description: 'Is active' })
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Created by user', required: false })
  @Column({ name: 'created_by', type: 'varchar', length: 255, nullable: true })
  createdBy?: string;
}

