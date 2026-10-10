import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export const MIGRATION_REPORT_STATUSES = [
  'applied',
  'reverted',
  'revert',
] as const;
export type MigrationReportStatus = (typeof MIGRATION_REPORT_STATUSES)[number];

/**
 * One applied (or reverting) run of a remediation job or cutover operation (plan 3.10, MIG02 / MIG05,
 * D11). Dry runs are read-only and leave no row; their report is printed. `tenant_id` null = all
 * tenants. `summary` holds the run's counts; `migration_changes` the row-level before / after trail.
 */
@Entity('migration_reports')
@Index('IDX_migration_reports_job', ['job', 'startedAt'])
@Index('IDX_migration_reports_tenant', ['tenantId'])
export class MigrationReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'job', type: 'varchar', length: 64 })
  job: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  @Column({ name: 'status', type: 'varchar', length: 16 })
  status: MigrationReportStatus;

  @Column({ name: 'actor', type: 'varchar', length: 255 })
  actor: string;

  @Column({ name: 'database_name', type: 'varchar', length: 128 })
  databaseName: string;

  @Column({ name: 'summary', type: 'jsonb' })
  summary: Record<string, unknown>;

  @Column({ name: 'reverts_report_id', type: 'uuid', nullable: true })
  revertsReportId: string | null;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @Column({ name: 'finished_at', type: 'timestamptz' })
  finishedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
