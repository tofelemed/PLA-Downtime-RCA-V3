import { ApiProperty } from '@nestjs/swagger';
import { Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Column, Index, ManyToOne, JoinColumn, VersionColumn } from 'typeorm';
import { RCA } from '../../rca/rca.entity';

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

  /** v2 ETag / If-Match (`PUT /v2/rcas/{id}/analyses/{tool}`); v1 saves bump it too */
  @VersionColumn({ name: 'row_version', default: 1 })
  rowVersion: number;

  @ApiProperty({ description: 'Tenant ID', required: false })
  @Column({ name: 'tenant_id', type: 'varchar', length: 36, nullable: true })
  tenantId?: string;

  @ApiProperty({ description: 'Organization ID', required: false })
  @Column({ name: 'organization_id', type: 'varchar', length: 36, nullable: true })
  organizationId?: string;

  @ApiProperty({ description: 'Associated RCA ID' })
  /** Child of its RCA: deleted with it; the row's tenant follows the RCA's (DB trigger, plan 3.11). */
  @Column({ name: 'rca_id', type: 'uuid' })
  rcaId: string;

  @ManyToOne(() => RCA, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rca_id' })
  rca?: RCA;

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


