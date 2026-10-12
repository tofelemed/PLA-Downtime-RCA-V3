import { useQuery } from '@tanstack/react-query';
import { shouldRetryQuery } from '@/app/query-client';
import type { ListResponse } from '../types/envelopes';
import type {
  CreateUserInput,
  GrantableRolesView,
  GrantScopeInput,
  UpdateUserInput,
  UserDirectoryEntry,
  UserScopeView,
  UserView,
} from '../types/administration';
import { adminCall, compactQuery, useAdminCommand, useAdminRead, useAdminRecord } from './administration-shared';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { usePagedQuery } from './use-paged-query';
import { useV2TenantId } from './use-v2-tenant';

/** Server filters of `GET /v2/users`. */
export interface UserFilters {
  q?: string;
  roles?: readonly string[];
  isActive?: boolean;
  sort?: 'name' | '-createdAt';
}

/** Members of the acting plant, 20 per page (keyset). */
export function useUsersPage(filters: UserFilters) {
  const query = compactQuery({ ...filters });
  return usePagedQuery<UserView>({ resource: 'users', path: '/users', query, key: { filters: query } });
}

export const useUser = (id: string | null | undefined) => useAdminRecord<UserView>('users', id, `/users/${id ?? ''}`);

/**
 * A user of the plant's organization by exact e-mail (`GET /v2/users/lookup`), to grant a first role in
 * this plant; disabled until an e-mail is given. A 404 (no such user in the organization) is not retried.
 */
export function useUserLookup(email: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.list(tenantId ?? '-', 'users', { filters: { lookup: email ?? '' } }),
    enabled: Boolean(tenantId && email),
    staleTime: STALE_TIME.users,
    retry: shouldRetryQuery,
    queryFn: ({ signal }) => adminCall<UserView>('GET', '/users/lookup', { query: { email: email ?? '' }, signal }),
  });
}

export const useGrantableRoles = () => useAdminRead<GrantableRolesView>('users', '/users/grantable-roles');

/**
 * Active members of the plant for pickers and name resolution (first 500 by name; a picker says when there
 * are more). A refusal is final: never retried, so name resolution degrades to "Unknown user" at once.
 */
export function useAssignableUsers(enabled = true) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.list(tenantId ?? '-', 'users', { filters: { directory: 'members' } }),
    enabled: Boolean(tenantId) && enabled,
    staleTime: STALE_TIME.users,
    retry: shouldRetryQuery,
    queryFn: ({ signal }) => adminCall<ListResponse<UserDirectoryEntry>>('GET', '/users/directory', { query: { limit: 500 }, signal }),
  });
}

/**
 * Names for user ids (`GET /v2/users/directory?ids=`): members of the plant, inactive ones too (backend item
 * B2). Ids are sorted so the cache key does not depend on order; at most 100 per call.
 */
export function useUserDirectoryNames(ids: readonly (string | null | undefined)[]) {
  const tenantId = useV2TenantId();
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))].sort().slice(0, 100);
  return useQuery({
    queryKey: v2Keys.list(tenantId ?? '-', 'users', { filters: { directory: unique } }),
    enabled: Boolean(tenantId) && unique.length > 0,
    staleTime: STALE_TIME.users,
    retry: shouldRetryQuery,
    queryFn: ({ signal }) => adminCall<ListResponse<UserDirectoryEntry>>('GET', '/users/directory', { query: { ids: unique }, signal }),
  });
}

export function useCreateUser() {
  return useAdminCommand<CreateUserInput, UserView>('user', (body, idempotencyKey) =>
    adminCall('POST', '/users', { body, idempotencyKey }),
  );
}

export function useUpdateUser() {
  return useAdminCommand<{ id: string; body: UpdateUserInput }, UserView>('user', ({ id, body }) =>
    adminCall('PATCH', `/users/${id}`, { body }),
  );
}

export function useDeleteUser() {
  return useAdminCommand<string, void>('user', (id) => adminCall('DELETE', `/users/${id}`));
}

/** Scope grants of one user in the acting plant (a user holds a handful; the list is paged by 20). */
export function useUserScopes(userId: string | null | undefined) {
  const query = compactQuery({ userId: userId ?? undefined });
  return usePagedQuery<UserScopeView>({
    resource: 'user-scopes',
    path: '/user-scopes',
    query,
    key: { filters: query },
    enabled: Boolean(userId),
  });
}

export function useGrantScope() {
  return useAdminCommand<GrantScopeInput, UserScopeView>('user_scope', (body, idempotencyKey) =>
    adminCall('POST', '/user-scopes', { body, idempotencyKey }),
  );
}

export function useRevokeScope() {
  return useAdminCommand<string, void>('user_scope', (id) => adminCall('DELETE', `/user-scopes/${id}`));
}
