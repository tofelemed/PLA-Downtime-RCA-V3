import { v2Request } from '../client';
import type { QueryParams } from '../request-url';
import type { JobAccepted } from '../types/envelopes';
import { useV2Command } from './use-v2-command';
import { useV2TenantId } from './use-v2-tenant';

export type ReportExportFormat = 'pdf' | 'xlsx';

export interface ReportExportInput {
  /** the Reports page view key (`daily`, `shift`, …) */
  kind: string;
  /** the report's own query, as its GET takes it (window, units and the report's options) */
  query: object;
  format: ReportExportFormat;
  currency: string;
}

/**
 * Starts the export of an operating report (`POST /reports/{kind}/export`, owner 2026-10-20): the server
 * reads the report with the same query as the page and renders a designed PDF or a workbook in the
 * background; the job is polled through `/exports/{id}` like every export.
 */
export function useCreateReportExport() {
  const tenantId = useV2TenantId();
  return useV2Command<ReportExportInput, JobAccepted>({
    run: async ({ input, idempotencyKey }) =>
      (
        await v2Request<JobAccepted>({
          method: 'POST',
          path: `/reports/${input.kind}/export`,
          query: input.query as QueryParams,
          body: { format: input.format, currency: input.currency },
          idempotencyKey,
        })
      ).data,
    changes: (_input, result) => (tenantId ? { tenantId, entityType: 'export_job', entityId: result.jobId } : null),
  });
}

const TYPES: Readonly<Record<ReportExportFormat, string>> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/** The file of a finished report export, as bytes. */
export async function downloadReportExport(exportId: string, format: ReportExportFormat): Promise<Blob> {
  const data = (await v2Request<Blob | string>({ method: 'GET', path: `/reports/exports/${exportId}/download`, asFile: true })).data;
  return typeof data === 'string' ? new Blob([data], { type: TYPES[format] }) : data;
}
