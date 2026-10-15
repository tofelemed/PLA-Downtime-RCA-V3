import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { Site } from '../../calendar/entities/site.entity';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { ExternalReportLine } from '../../domain/actuals/period/external-report';

export const REPORT_STATES = ['current', 'superseded'] as const;
export type ReportState = (typeof REPORT_STATES)[number];

/**
 * An imported external daily-production record (spec §14.2 `external_production_reports`, ACT08): report
 * id + revision (unique per tenant), site, local production date, timezone, UTC boundaries, lines per
 * unit/product, quantity basis, source status, certified eligibility (status mapping), approval time at
 * the source and evidence. A later revision supersedes the earlier one (quantities are never summed) and
 * is a correction candidate for the periods it covers.
 */
@Entity('external_production_reports')
@Unique('UQ_external_production_reports_revision', [
  'tenantId',
  'externalReportId',
  'externalRevision',
])
@Index('IDX_external_production_reports_site_date', [
  'tenantId',
  'siteId',
  'localProductionDate',
])
@Index('IDX_external_production_reports_window', ['tenantId', 'utcStart'])
@Index('IDX_external_production_reports_site', ['siteId'])
@Check('CHK_external_production_reports_window', '"utc_end" > "utc_start"')
export class ExternalProductionReport extends TenantScopedEntity {
  /** integration connection that delivered it (null = API / file import) */
  @Column({ name: 'connection_id', type: 'uuid', nullable: true })
  connectionId: string | null;

  @Column({ name: 'external_report_id', type: 'varchar', length: 128 })
  externalReportId: string;

  @Column({ name: 'external_revision', type: 'varchar', length: 64 })
  externalRevision: string;

  @Column({ name: 'site_id', type: 'uuid' })
  siteId: string;

  @ManyToOne(() => Site, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'site_id',
    foreignKeyConstraintName: 'FK_external_production_reports_site',
  })
  site?: Site;

  @Column({ name: 'local_production_date', type: 'date' })
  localProductionDate: string;

  @Column({ name: 'timezone', type: 'varchar', length: 64 })
  timezone: string;

  @Column({ name: 'utc_start', type: 'timestamptz' })
  utcStart: Date;

  @Column({ name: 'utc_end', type: 'timestamptz' })
  utcEnd: Date;

  @Column({ name: 'lines', type: 'jsonb' })
  lines: ExternalReportLine[];

  @Column({ name: 'basis', type: 'varchar', length: 8 })
  basis: 'gross' | 'good';

  @Column({ name: 'source_status', type: 'varchar', length: 64 })
  sourceStatus: string;

  /** SME R13: the source system whose status mapping decides release (`import` = API / file import) */
  @Column({
    name: 'source_system',
    type: 'varchar',
    length: 64,
    default: 'import',
  })
  sourceSystem: string;

  /** the approved `source_status_mappings` version that decided `certified_eligible` (null = none in force) */
  @Column({ name: 'status_mapping_id', type: 'uuid', nullable: true })
  statusMappingId: string | null;

  @Column({ name: 'certified_eligible', type: 'boolean' })
  certifiedEligible: boolean;

  @Column({ name: 'approved_at_source', type: 'timestamptz', nullable: true })
  approvedAtSource: Date | null;

  @Column({ name: 'evidence_ref', type: 'text', nullable: true })
  evidenceRef: string | null;

  @Column({
    name: 'state',
    type: 'enum',
    enum: REPORT_STATES,
    enumName: 'external_production_report_state',
    default: 'current',
  })
  state: ReportState;

  @Column({ name: 'superseded_by_id', type: 'uuid', nullable: true })
  supersededById: string | null;

  @Column({ name: 'imported_at', type: 'timestamptz' })
  importedAt: Date;

  @Column({ name: 'imported_by', type: 'uuid', nullable: true })
  importedBy: string | null;
}
