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

@Entity('pi_mappings')
@Index(['tenantId'])
@Index(['organizationId'])
@Index(['createdAt'])
export class PIMapping {
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

  @ApiProperty({ description: 'Source type', required: false })
  @Column({ name: 'source_type', type: 'varchar', length: 100, nullable: true })
  sourceType?: string;

  @ApiProperty({ description: 'Source ID', required: false })
  @Column({ name: 'source_id', type: 'varchar', length: 255, nullable: true })
  sourceId?: string;

  @ApiProperty({ description: 'Target type', required: false })
  @Column({ name: 'target_type', type: 'varchar', length: 100, nullable: true })
  targetType?: string;

  @ApiProperty({ description: 'Target ID', required: false })
  @Column({ name: 'target_id', type: 'varchar', length: 36, nullable: true })
  targetId?: string;

  @ApiProperty({ description: 'Mapping rules as JSON', required: false })
  @Column({ name: 'mapping_rules', type: 'text', nullable: true })
  mappingRules?: string;

  @ApiProperty({ description: 'Is active' })
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
