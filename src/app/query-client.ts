import { QueryClient } from '@tanstack/react-query';
import { V2ApiError } from '@/api/v2/errors';

/** Client errors (4xx) are answers, not outages: never retried. Everything else is retried twice. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof V2ApiError && error.status < 500 && !error.retryable) return false;
  return failureCount < 2;
}

/** The app's single TanStack Query cache (plan 3.1, UX02); per-resource stale times live in the hooks. */
export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetryQuery, staleTime: 30_000 },
      mutations: { retry: false },
    },
  });
}
