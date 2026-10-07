import { ApiProperty } from '@nestjs/swagger';
import { Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Column, Index } from 'typeorm';

@Entity('rca_fishbone_diagrams')
@Index(['tenantId'])
@Index(['organizationId'])
@Index(['rcaId'])
export class RcaFishboneDiagram {
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

  @ApiProperty({ description: 'Effect being analyzed' })
  @Column({ type: 'text' })
  effect: string;

  @ApiProperty({ description: 'Fishbone categories', type: 'array' })
  @Column({ name: 'categories', type: 'simple-json' })
  categories: Record<string, any>[];
}


