import { v2Request } from '../client';
import type { JobAccepted } from '../types/envelopes';
import type { RcaCaseExportRequest } from '../types/rca-case-export';
import { useV2Command } from './use-v2-command';
import { useV2TenantId } from './use-v2-tenant';

/**
 * Starts the server PDF of one RCA case (item 2.5, `POST /exports` with `reportType: 'rca_case'`); the job is
 * then polled with `useExportJob` and the file downloaded with `downloadExportFile`.
 */
export function useCreateRcaCaseExport() {
  const tenantId = useV2TenantId();
  return useV2Command<RcaCaseExportRequest, JobAccepted>({
    run: async ({ input, idempotencyKey }) => (await v2Request<JobAccepted>({ method: 'POST', path: '/exports', body: input, idempotencyKey })).data,
    changes: (_input, result) => (tenantId ? { tenantId, entityType: 'export_job', entityId: result.jobId } : null),
  });
}
