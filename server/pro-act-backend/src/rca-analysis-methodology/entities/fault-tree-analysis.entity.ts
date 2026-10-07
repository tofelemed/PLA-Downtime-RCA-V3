import { ApiProperty } from '@nestjs/swagger';
import { Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Column, Index } from 'typeorm';

@Entity('rca_fault_tree_analyses')
@Index(['tenantId'])
@Index(['organizationId'])
@Index(['rcaId'])
export class RcaFaultTreeAnalysis {
  @ApiProperty({ description: 'Primary key UUID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ApiProperty({ description: 'Tenant ID', required: false })
  @Column({ name: 'tenant_id', type: 'varchar', length: 36, nullable: true })
  tenantId?: string;

  @ApiProperty({ description: 'Organization ID', required: false })
  @Column({ name: 'organization_id', type: 'varchar', length: 36, nullable: true })
  organizationId?: string;

  @ApiProperty({ description: 'Associated RCA ID' })
  @Column({ name: 'rca_id', type: 'varchar', length: 36 })
  rcaId: string;

  @ApiProperty({ description: 'Top event of the fault tree' })
  @Column({ name: 'top_event', type: 'varchar', length: 255 })
  topEvent: string;

  @ApiProperty({ description: 'Fault tree nodes', type: 'array' })
  @Column({ name: 'nodes', type: 'simple-json' })
  nodes: Record<string, any>[];

  @ApiProperty({ description: 'Minimum cut sets', required: false, type: 'array' })
  @Column({ name: 'minimum_cut_sets', type: 'simple-json', nullable: true })
  minimumCutSets?: string[][];
}


