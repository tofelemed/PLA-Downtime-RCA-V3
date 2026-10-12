import { useQuery } from '@tanstack/react-query';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { ApiError } from '@/services/api/httpClient';

/** Directory lists change rarely: fresh for 10 minutes, shared by every screen of the tenant. */
const DIRECTORY_STALE_MS = 10 * 60 * 1000;

/** A refusal (4xx) is final: no retry, the resolver falls back silently. */
function retryUnlessRefused(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

/** A v1 directory list keyed `['v1', tenantId, ...resource]`; disabled until the acting tenant is known. */
export function useV1Directory<T>(resource: readonly string[], fetchList: () => Promise<T[]>) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: ['v1', tenantId ?? '-', ...resource],
    enabled: Boolean(tenantId),
    staleTime: DIRECTORY_STALE_MS,
    retry: retryUnlessRefused,
    queryFn: fetchList,
  });
}
