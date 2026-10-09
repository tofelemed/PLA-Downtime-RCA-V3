import { v2 } from '../v2';
import type { ExportRequest } from './reports';
import { useV2Command } from './use-v2-command';
import { useV2TenantId } from './use-v2-tenant';

/** Accepted export job (plan 2.9): the server builds the file from the stated selector and filters. */
export interface ExportJobView {
  id: string;
  state: string;
  reportType: string;
}

/**
 * Starts an export job (`POST /exports`, 2.9) from a report snapshot's request, so the file carries the
 * same filters and calculation version as the page that asked for it (T24).
 */
export function useCreateExport() {
  const tenantId = useV2TenantId();
  return useV2Command<ExportRequest, ExportJobView>({
    run: async ({ input, idempotencyKey }) =>
      (await v2.post<ExportJobView, '/api/v2/exports'>('/api/v2/exports', { body: input, idempotencyKey })).data,
    changes: (_input, result) => (tenantId ? { tenantId, entityType: 'export_job', entityId: result.id } : null),
  });
}
