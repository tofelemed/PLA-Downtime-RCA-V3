import { useQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { ListResponse } from '../types/envelopes';
import type { SourceAuthorityInForceView, SourceAuthorityVersionView } from '../types/source-authority';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2Command } from './use-v2-command';
import { useV2TenantId } from './use-v2-tenant';

/** Most versions a unit lists (a handful of changes a year). */
const PAGE = 100;

/** The source authority version in force for a unit (its own, else tenant-wide). */
export function useSourceAuthorityInForce(unitId: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'source-authority', unitId ?? '-'),
    enabled: Boolean(tenantId && unitId),
    staleTime: STALE_TIME['source-authority'],
    queryFn: async ({ signal }) => (await v2Request<SourceAuthorityInForceView>({ method: 'GET', path: '/source-authority', query: { unitId: unitId ?? '' }, signal })).data,
  });
}

/** The unit's own source authority versions, newest first: drafts, approved and rejected. */
export function useSourceAuthorityVersions(unitId: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.list(tenantId ?? '-', 'source-authority', { scope: { unitIds: unitId ? [unitId] : [] } }),
    enabled: Boolean(tenantId && unitId),
    staleTime: STALE_TIME['source-authority'],
    queryFn: async ({ signal }) =>
      (await v2Request<ListResponse<SourceAuthorityVersionView>>({ method: 'GET', path: '/source-authority/versions', query: { unitId: unitId ?? '', limit: PAGE }, signal })).data,
  });
}

/** Production accounting approves or rejects a draft (never its author: 403 SEPARATION_OF_DUTIES; 409 STALE_DRAFT). */
export function useDecideSourceAuthorityVersion() {
  const tenantId = useV2TenantId();
  return useV2Command<{ id: string; decision: 'approve' | 'reject'; reason?: string }, SourceAuthorityVersionView>({
    run: async ({ input, idempotencyKey }) =>
      (await v2Request<SourceAuthorityVersionView>({ method: 'POST', path: `/source-authority/versions/${input.id}/${input.decision}`, body: input.reason ? { reason: input.reason } : {}, idempotencyKey })).data,
    changes: () => (tenantId ? { tenantId, entityType: 'source_authority' } : null),
    retries: 0,
  });
}
