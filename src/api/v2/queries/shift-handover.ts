import { useQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { QueryParams } from '../request-url';
import type { BodyOf, QueryOf } from '../schema-types';
import type { AnalyticsResponse } from '../types/envelopes';
import type { ShiftHandoverView, ShiftNoteView } from '../types/ops-reports';
import { v2 } from '../v2';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2Command } from './use-v2-command';
import { useV2TenantId } from './use-v2-tenant';

export type ShiftHandoverQuery = QueryOf<'/api/v2/reports/shift-handover', 'get'>;
export type ShiftNoteBody = BodyOf<'/api/v2/shift-notes', 'post'>;

/** R2: one shift on the units — output, events and handover notes, read on the server. Null query = idle. */
export function useShiftHandover(query: ShiftHandoverQuery | null) {
  const tenantId = useV2TenantId();
  return useQuery<AnalyticsResponse<ShiftHandoverView>>({
    queryKey: v2Keys.list(tenantId ?? '-', 'reports', { filters: { kind: 'shift-handover', ...query } }),
    enabled: Boolean(tenantId && query),
    staleTime: STALE_TIME.reports,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) =>
      (await v2Request<AnalyticsResponse<ShiftHandoverView>>({
        method: 'GET',
        path: '/reports/shift-handover',
        query: (query ?? {}) as unknown as QueryParams,
        signal,
      })).data,
  });
}

/** R2: appends a handover note; the handover read is refreshed. */
export function useCreateShiftNote() {
  const tenantId = useV2TenantId();
  return useV2Command<ShiftNoteBody, ShiftNoteView>({
    run: async ({ input, idempotencyKey }) => (await v2.post<ShiftNoteView, '/api/v2/shift-notes'>('/api/v2/shift-notes', { body: input, idempotencyKey })).data,
    changes: () => (tenantId ? { tenantId, entityType: 'shift_note', window: null } : null),
  });
}
