import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('pi_af_elements')
@Index(['tenantId'])
@Index(['organizationId'])
@Index(['createdAt'])
@Index(['parentId'])
@Index(['template'])
@Index(['webId'])
export class PIAfElement {
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

  @ApiProperty({ description: 'PI Web ID (unique)', required: false })
  @Column({ name: 'web_id', type: 'varchar', length: 255, unique: true, nullable: true })
  webId?: string;

  @ApiProperty({ description: 'Element name', required: false })
  @Column({ type: 'varchar', length: 255, nullable: true })
  name?: string;

  @ApiProperty({ description: 'Description', required: false })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @ApiProperty({ description: 'Element path', required: false })
  @Column({ type: 'varchar', length: 1000, nullable: true })
  path?: string;

  @ApiProperty({ description: 'Template name', required: false })
  @Column({ type: 'varchar', length: 255, nullable: true })
  template?: string;

  @ApiProperty({ description: 'Categories as JSON', required: false })
  @Column({ type: 'text', nullable: true })
  categories?: string;

  @ApiProperty({ description: 'Parent element ID', required: false })
  @Column({ name: 'parent_id', type: 'varchar', length: 36, nullable: true })
  parentId?: string;

  @ApiProperty({ description: 'Hierarchy level', required: false })
  @Column({ name: 'hierarchy_level', type: 'int', nullable: true })
  hierarchyLevel?: number;

  @ApiProperty({ description: 'Last seen timestamp', required: false })
  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: true })
  lastSeenAt?: Date;

  @ApiProperty({ description: 'Has children' })
  @Column({ name: 'has_children', type: 'boolean', default: false })
  hasChildren: boolean;

  @ApiProperty({ description: 'Additional metadata as JSON', required: false })
  @Column({ type: 'text', nullable: true })
  metadata?: string;
}

