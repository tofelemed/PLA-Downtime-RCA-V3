import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { ExportLabels } from '../export-labels';
import { RcaCaseExportContent } from '../rca-case/rca-case-content';
import { ExportPresentation } from '../pdf/pdf-model';
import { ReportDocument } from '../report/report-document';

/** `rca_case` (item 2.5): one RCA case as a PDF, its content pinned on the job (`case_content`). */
export const REQUESTABLE_REPORT_TYPES = [
  'period_summary',
  'loss_lines',
  'rca_case',
] as const;
/** `ops_report` (plans/REPORTS_R1_R12.md): an operating report, requested through `/reports/{kind}/export`. */
export const EXPORT_REPORT_TYPES = [
  ...REQUESTABLE_REPORT_TYPES,
  'ops_report',
] as const;
export type ExportReportType = (typeof EXPORT_REPORT_TYPES)[number];

/** Formats `POST /exports` accepts; `xlsx` is an operating report workbook only. */
export const REQUESTABLE_FORMATS = ['csv', 'pdf'] as const;
export const EXPORT_FORMATS = [...REQUESTABLE_FORMATS, 'xlsx'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/**
 * `published` = the latest approved revision of every period in the window; `revision_ids` = named approved
 * revisions; `case` = one RCA case (`rca_case` only, no revisions).
 */
export const REQUESTABLE_SELECTORS = [
  'published',
  'revision_ids',
  'case',
] as const;
/** `report`: an operating report's own window and units (`ops_report`, no pinned revisions). */
export const EXPORT_SELECTORS = [...REQUESTABLE_SELECTORS, 'report'] as const;
export type ExportSelector = (typeof EXPORT_SELECTORS)[number];

export const EXPORT_JOB_STATES = [
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const;
export type ExportJobState = (typeof EXPORT_JOB_STATES)[number];

/** API04 counts: accepted = pinned source revisions; processed = rendered; nothing is quarantined or rejected. */
export interface ExportCounts {
  accepted: number;
  processed: number;
  quarantined: number;
  rejected: number;
  pending: number;
}

/** The request as given (normalized); the content is the pinned `export_job_sources`, not a re-run of these. */
export interface ExportFilters {
  from: string | null;
  to: string | null;
  unitIds: string[] | null;
  revisionIds: string[] | null;
  /** `rca_case`: the exported case (absent on period exports) */
  rcaId?: string | null;
}

const bigintAsNumber = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

/**
 * Report export job (plan 2.9, §14.2 `export_jobs`, API04, AN03). The approved revisions it renders are
 * pinned in `export_job_sources` when it is requested, so later recalculations or approvals never change
 * its content. `unit_ids` is the content scope (null = tenant-wide): only callers allowed to see every one
 * of those units see the job and download its file. The file is immutable once `completed`, expires at
 * `expires_at`, and a cancelled job never has one.
 */
@Entity('export_jobs')
@Index('IDX_export_jobs_tenant_created', ['tenantId', 'createdAt'])
@Index('IDX_export_jobs_state_created', ['state', 'createdAt'])
@Index('IDX_export_jobs_expires', ['expiresAt'], {
  where: `"object_key" IS NOT NULL`,
})
export class ExportJob extends TenantScopedEntity {
  @Column({
    name: 'report_type',
    type: 'enum',
    enum: EXPORT_REPORT_TYPES,
    enumName: 'export_report_type',
  })
  reportType: ExportReportType;

  @Column({
    name: 'format',
    type: 'enum',
    enum: EXPORT_FORMATS,
    enumName: 'export_format',
  })
  format: ExportFormat;

  @Column({
    name: 'revision_selector',
    type: 'enum',
    enum: EXPORT_SELECTORS,
    enumName: 'export_revision_selector',
  })
  revisionSelector: ExportSelector;

  @Column({ name: 'filters', type: 'jsonb' })
  filters: ExportFilters;

  /** PDF only: plant display settings and display currency pinned at request time (null for CSV) */
  @Column({ name: 'presentation', type: 'jsonb', nullable: true })
  presentation: ExportPresentation | null;

  /** requester name, plant clock and reason code names pinned at request time (null on older jobs) */
  @Column({ name: 'labels', type: 'jsonb', nullable: true })
  labels: ExportLabels | null;

  /** `rca_case`: the case as read when the export was requested (null for period exports) */
  @Column({ name: 'case_content', type: 'jsonb', nullable: true })
  caseContent: RcaCaseExportContent | null;

  /** `ops_report`: the report document as read when the export was requested */
  @Column({ name: 'report_content', type: 'jsonb', nullable: true })
  reportContent: ReportDocument | null;

  /** content scope; null = tenant-wide (needs a tenant-wide grant to see or download) */
  @Column({ name: 'unit_ids', type: 'uuid', array: true, nullable: true })
  unitIds: string[] | null;

  @Column({ name: 'requested_by', type: 'uuid' })
  requestedBy: string;

  @Column({
    name: 'state',
    type: 'enum',
    enum: EXPORT_JOB_STATES,
    enumName: 'export_job_state',
    default: 'queued',
  })
  state: ExportJobState;

  @Column({ name: 'counts', type: 'jsonb' })
  counts: ExportCounts;

  /** cancelled after some sources were rendered (nothing of it is kept or downloadable) */
  @Column({ name: 'partial', type: 'boolean', default: false })
  partial: boolean;

  @Column({ name: 'cancel_requested', type: 'boolean', default: false })
  cancelRequested: boolean;

  /** storage key `<tenant>/<job>.<format>`, generated by the server; null until completed and after expiry */
  @Column({ name: 'object_key', type: 'varchar', length: 255, nullable: true })
  objectKey: string | null;

  /** sha256 of the file bytes */
  @Column({ name: 'content_hash', type: 'varchar', length: 64, nullable: true })
  contentHash: string | null;

  @Column({
    name: 'size_bytes',
    type: 'bigint',
    nullable: true,
    transformer: bigintAsNumber,
  })
  sizeBytes: number | null;

  @Column({ name: 'row_count', type: 'int', nullable: true })
  rowCount: number | null;

  @Column({ name: 'generated_at', type: 'timestamptz', nullable: true })
  generatedAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'download_count', type: 'int', default: 0 })
  downloadCount: number;

  @Column({ name: 'error_code', type: 'varchar', length: 64, nullable: true })
  errorCode: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'attempts', type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'lease_owner', type: 'varchar', length: 128, nullable: true })
  leaseOwner: string | null;

  @Column({ name: 'lease_expiry', type: 'timestamptz', nullable: true })
  leaseExpiry: Date | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;
}
