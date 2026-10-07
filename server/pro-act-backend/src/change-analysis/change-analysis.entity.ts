import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('change_analyses')
@Index(['tenantId'])
@Index(['organizationId'])
@Index(['createdAt'])
@Index(['rcaId'])
export class ChangeAnalysis {
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

  @ApiProperty({ description: 'Change description', required: false })
  @Column({ name: 'change_description', type: 'text', nullable: true })
  changeDescription?: string;

  @ApiProperty({ description: 'Changes as JSON', required: false })
  @Column({ type: 'text', nullable: true })
  changes?: string;
}

