import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('barrier_analyses')
@Index(['tenantId'])
@Index(['organizationId'])
@Index(['createdAt'])
@Index(['rcaId'])
export class BarrierAnalysis {
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
  @Column({ name: 'tenant_id', type: 'varchar', length: 36, nullable: true })
  tenantId?: string;

  @ApiProperty({ description: 'Organization ID', required: false })
  @Column({ name: 'organization_id', type: 'varchar', length: 36, nullable: true })
  organizationId?: string;

  @ApiProperty({ description: 'RCA ID' })
  @Column({ name: 'rca_id', type: 'varchar', length: 36 })
  rcaId: string;

  @ApiProperty({ description: 'Hazard description', required: false })
  @Column({ type: 'text', nullable: true })
  hazard?: string;

  @ApiProperty({ description: 'Barriers as JSON', required: false })
  @Column({ type: 'text', nullable: true })
  barriers?: string;
}

