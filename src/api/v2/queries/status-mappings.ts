import { useQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { SourceStatusMappingCreateBody, SourceStatusMappingView } from '../types/status-mappings';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2Command } from './use-v2-command';
import { useV2TenantId } from './use-v2-tenant';

/** Every mapping version of the acting plant, newest first per source, with the version in force (SME R13). */
export function useStatusMappings() {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.list(tenantId ?? '-', 'status-mappings'),
    enabled: Boolean(tenantId),
    staleTime: STALE_TIME['status-mappings'],
    queryFn: async ({ signal }) => (await v2Request<{ items: SourceStatusMappingView[] }>({ method: 'GET', path: '/source-status-mappings', signal })).data,
  });
}

function useStatusMappingCommand<TInput>(path: (input: TInput) => string, body: (input: TInput) => unknown) {
  const tenantId = useV2TenantId();
  return useV2Command<TInput, SourceStatusMappingView>({
    run: async ({ input, idempotencyKey }) => (await v2Request<SourceStatusMappingView>({ method: 'POST', path: path(input), body: body(input), idempotencyKey })).data,
    changes: () => (tenantId ? { tenantId, entityType: 'source_status_mapping' } : null),
    retries: 0,
  });
}

/** Drafts a new version of a source (integration admins, production accounting). */
export function useCreateStatusMapping() {
  return useStatusMappingCommand<SourceStatusMappingCreateBody>(
    () => '/source-status-mappings',
    (input) => input,
  );
}

/** The source owner approves a draft version (never its author: 403 SEPARATION_OF_DUTIES). */
export function useApproveStatusMapping() {
  return useStatusMappingCommand<{ id: string }>(
    ({ id }) => `/source-status-mappings/${id}/approve`,
    () => ({}),
  );
}
