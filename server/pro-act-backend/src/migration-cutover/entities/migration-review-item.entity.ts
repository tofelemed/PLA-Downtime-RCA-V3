import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/**
 * A legacy row a remediation job could not fix without a human decision (plan 3.10, §18.2 "quarantine /
 * review"): unknown duration unit, unresolved tenant, ambiguous period, duplicate with conflicting
 * edits, ambiguous `standard_rate` (D08), missing currency / uom mapping. One row per job, legacy row and
 * issue (re-runs add nothing); the data owner resolves or dismisses it (D11).
 */
@Entity('migration_review')
@Unique('UQ_migration_review_item', ['job', 'legacyTable', 'legacyId', 'issue'])
@Index('IDX_migration_review_tenant_status', ['tenantId', 'status'])
@Index('IDX_migration_review_report', ['reportId'])
@Check(
  'CHK_migration_review_status',
  `"status" IN ('open', 'resolved', 'dismissed')`,
)
export class MigrationReviewItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  @Column({ name: 'job', type: 'varchar', length: 64 })
  job: string;

  @Column({ name: 'legacy_table', type: 'varchar', length: 64 })
  legacyTable: string;

  @Column({ name: 'legacy_id', type: 'varchar', length: 255 })
  legacyId: string;

  @Column({ name: 'issue', type: 'varchar', length: 64 })
  issue: string;

  @Column({ name: 'details', type: 'jsonb' })
  details: Record<string, unknown>;

  @Column({ name: 'status', type: 'varchar', length: 16, default: 'open' })
  status: 'open' | 'resolved' | 'dismissed';

  @Column({ name: 'report_id', type: 'uuid' })
  reportId: string;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolved_by', type: 'varchar', length: 255, nullable: true })
  resolvedBy: string | null;

  @Column({ name: 'resolution', type: 'text', nullable: true })
  resolution: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
