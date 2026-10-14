import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('af_bindings')
@Index(['tenantId'])
@Index(['organizationId'])
@Index(['createdAt'])
@Index(['webId'])
@Index(['boundType'])
@Index(['localId'])
export class AfBinding {
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

  @ApiProperty({ description: 'Local entity ID', required: false })
  @Column({ name: 'local_id', type: 'varchar', length: 36, nullable: true })
  localId?: string;

  @ApiProperty({ description: 'Bound type', required: false })
  @Column({ name: 'bound_type', type: 'varchar', length: 100, nullable: true })
  boundType?: string;

  @ApiProperty({ description: 'Mapping configuration as JSON', required: false })
  @Column({ name: 'mapping_config', type: 'text', nullable: true })
  mappingConfig?: string;

  @ApiProperty({ description: 'Is active' })
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}

