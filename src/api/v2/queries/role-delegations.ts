import { useQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { ListResponse } from '../types/envelopes';
import type { CreateRoleDelegationInput, RoleDelegationView } from '../types/role-delegations';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2Command } from './use-v2-command';
import { useV2TenantId } from './use-v2-tenant';

/** SME R1 / R6: the plant's newest 100 delegations (`in_force` or all; server keyset, newest first). */
export function useRoleDelegations(state: 'in_force' | 'all') {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.list(tenantId ?? '-', 'user-scopes', { filters: { kind: 'role-delegations', state } }),
    enabled: Boolean(tenantId),
    staleTime: STALE_TIME['user-scopes'],
    queryFn: async ({ signal }) =>
      (await v2Request<ListResponse<RoleDelegationView>>({ method: 'GET', path: '/role-delegations', query: { state, limit: 100 }, signal })).data,
  });
}

const changed = (tenantId: string | null) => (tenantId ? { tenantId, entityType: 'user_scope', window: null } : null);

export function useCreateDelegation() {
  const tenantId = useV2TenantId();
  return useV2Command<CreateRoleDelegationInput, RoleDelegationView>({
    run: async ({ input, idempotencyKey }) =>
      (await v2Request<RoleDelegationView>({ method: 'POST', path: '/role-delegations', body: input, idempotencyKey })).data,
    changes: () => changed(tenantId),
    retries: 0,
  });
}

export function useRevokeDelegation() {
  const tenantId = useV2TenantId();
  return useV2Command<{ id: string; reason: string }, RoleDelegationView>({
    run: async ({ input, idempotencyKey }) =>
      (await v2Request<RoleDelegationView>({ method: 'POST', path: `/role-delegations/${input.id}/revoke`, body: { reason: input.reason }, idempotencyKey })).data,
    changes: () => changed(tenantId),
    retries: 0,
  });
}
