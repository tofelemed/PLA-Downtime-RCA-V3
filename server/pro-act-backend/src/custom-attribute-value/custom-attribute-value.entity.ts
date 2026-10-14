import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('custom_attribute_values')
@Index(['tenantId'])
@Index(['organizationId'])
@Index(['createdAt'])
@Index(['entityId'])
@Index(['entityType'])
@Index(['attributeDefinitionId'])
export class CustomAttributeValue {
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

  @ApiProperty({ description: 'Entity ID' })
  @Column({ name: 'entity_id', type: 'varchar', length: 36 })
  entityId: string;

  @ApiProperty({ description: 'Entity type' })
  @Column({ name: 'entity_type', type: 'varchar', length: 100 })
  entityType: string;

  @ApiProperty({ description: 'Attribute definition ID' })
  @Column({ name: 'attribute_definition_id', type: 'varchar', length: 36 })
  attributeDefinitionId: string;

  @ApiProperty({ description: 'Attribute value', required: false })
  @Column({ name: 'value', type: 'text', nullable: true })
  value?: string;
}
