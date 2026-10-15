import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { RCA } from '../rca/rca.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('fishbone_diagrams')
@Index(['tenantId'])
@Index(['organizationId'])
@Index(['createdAt'])
@Index(['rcaId'])
export class FishboneDiagram {
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

  @ApiProperty({ description: 'RCA ID' })
  /** Child of its RCA: deleted with it; the row's tenant follows the RCA's (DB trigger, plan 3.11). */
  @Column({ name: 'rca_id', type: 'uuid' })
  rcaId: string;

  @ManyToOne(() => RCA, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rca_id' })
  rca?: RCA;

  @ApiProperty({ description: 'Problem statement', required: false })
  @Column({ name: 'problem_statement', type: 'text', nullable: true })
  problemStatement?: string;

  @ApiProperty({ description: 'Categories as JSON', required: false })
  @Column({ type: 'text', nullable: true })
  categories?: string;

  @ApiProperty({ description: 'Causes as JSON', required: false })
  @Column({ type: 'text', nullable: true })
  causes?: string;
}

