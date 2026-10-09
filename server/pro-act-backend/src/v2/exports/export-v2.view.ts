import {
  ExportCounts,
  ExportFilters,
  ExportJob,
} from '../../exports/entities/export-job.entity';

/** An export job as v2 returns it (API04 status; the download link only while the file is available). */
export interface ExportV2View {
  id: string;
  reportType: string;
  format: string;
  revisionSelector: string;
  filters: ExportFilters;
  /** content scope; null = tenant-wide */
  unitIds: string[] | null;
  /** exports contain approved content only */
  status: 'approved';
  state: string;
  counts: ExportCounts;
  partial: boolean;
  cancelRequested: boolean;
  rowCount: number | null;
  sizeBytes: number | null;
  contentHash: string | null;
  requestedBy: string;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  generatedAt: string | null;
  expiresAt: string | null;
  downloadCount: number;
  downloadUrl: string | null;
  sourcesUrl: string;
  error: { code: string; message: string | null } | null;
  rowVersion: number;
}

const iso = (value: Date | null) => (value ? value.toISOString() : null);

function downloadable(job: ExportJob, now: Date): boolean {
  return (
    job.state === 'completed' &&
    job.objectKey !== null &&
    (job.expiresAt === null || job.expiresAt > now)
  );
}

export function toExportView(job: ExportJob, now = new Date()): ExportV2View {
  return {
    id: job.id,
    reportType: job.reportType,
    format: job.format,
    revisionSelector: job.revisionSelector,
    filters: job.filters,
    unitIds: job.unitIds,
    status: 'approved',
    state: job.state,
    counts: job.counts,
    partial: job.partial,
    cancelRequested: job.cancelRequested,
    rowCount: job.rowCount,
    sizeBytes: job.sizeBytes,
    contentHash: job.contentHash,
    requestedBy: job.requestedBy,
    requestedAt: job.createdAt.toISOString(),
    startedAt: iso(job.startedAt),
    finishedAt: iso(job.finishedAt),
    generatedAt: iso(job.generatedAt),
    expiresAt: iso(job.expiresAt),
    downloadCount: job.downloadCount,
    downloadUrl: downloadable(job, now)
      ? `/api/v2/exports/${job.id}/download`
      : null,
    sourcesUrl: `/api/v2/exports/${job.id}/sources`,
    error: job.errorCode
      ? { code: job.errorCode, message: job.errorMessage }
      : null,
    rowVersion: job.rowVersion,
  };
}
