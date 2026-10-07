import { ApiProperty } from '@nestjs/swagger';
import { Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Column, Index } from 'typeorm';

@Entity('rca_five_why_analyses')
@Index(['tenantId'])
@Index(['organizationId'])
@Index(['rcaId'])
export class RcaFiveWhyAnalysis {
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

  @ApiProperty({ description: 'Problem statement' })
  @Column({ type: 'text' })
  problem: string;

  @ApiProperty({ description: 'Why levels', type: 'array' })
  @Column({ name: 'why_levels', type: 'simple-json' })
  whyLevels: Record<string, any>[];

  @ApiProperty({ description: 'Root cause identified' })
  @Column({ name: 'root_cause', type: 'text' })
  rootCause: string;

  @ApiProperty({ description: 'Verified by user ID', required: false })
  @Column({ name: 'verified_by', type: 'varchar', length: 255, nullable: true })
  verifiedBy?: string;

  @ApiProperty({ description: 'Verification date', required: false })
  @Column({ name: 'verified_date', type: 'timestamptz', nullable: true })
  verifiedDate?: Date;
}


