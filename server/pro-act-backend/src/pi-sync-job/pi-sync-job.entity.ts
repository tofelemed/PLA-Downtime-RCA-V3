import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('pi_sync_jobs')
@Index(['tenantId'])
@Index(['organizationId'])
@Index(['createdAt'])
export class PISyncJob {
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

  @ApiProperty({ description: 'Job name', required: false })
  @Column({ name: 'job_name', type: 'varchar', length: 255, nullable: true })
  jobName?: string;

  @ApiProperty({ description: 'Job type', required: false })
  @Column({ name: 'job_type', type: 'varchar', length: 100, nullable: true })
  jobType?: string;

  @ApiProperty({ description: 'Schedule (cron expression)', required: false })
  @Column({ type: 'varchar', length: 255, nullable: true })
  schedule?: string;

  @ApiProperty({ description: 'Last run time', required: false })
  @Column({ name: 'last_run_time', type: 'timestamptz', nullable: true })
  lastRunTime?: Date;

  @ApiProperty({ description: 'Next run time', required: false })
  @Column({ name: 'next_run_time', type: 'timestamptz', nullable: true })
  nextRunTime?: Date;

  @ApiProperty({ description: 'Job status', required: false })
  @Column({ type: 'varchar', length: 50, nullable: true })
  status?: string;

  @ApiProperty({ description: 'Error message', required: false })
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @ApiProperty({ description: 'Job configuration as JSON', required: false })
  @Column({ name: 'job_config', type: 'text', nullable: true })
  jobConfig?: string;

  @ApiProperty({ description: 'Is active' })
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}

