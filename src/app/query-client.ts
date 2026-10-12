import { QueryClient } from '@tanstack/react-query';
import { V2ApiError } from '@/api/v2/errors';

/** Unused results stay cached for 10 minutes, so going back to a screen shows it at once. */
export const QUERY_GC_TIME_MS = 10 * 60_000;
/** Default freshness; each v2 hook sets its data class's own (`src/api/v2/queries/stale-times.ts`). */
export const DEFAULT_STALE_TIME_MS = 30_000;

const MAX_RETRIES = 2;

/** HTTP status of a failed v1 or v2 call, when it carries one. */
function statusOf(error: unknown): number | null {
  if (error instanceof V2ApiError) return error.status;
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status: unknown }).status;
    return typeof status === 'number' ? status : null;
  }
  return null;
}

/**
 * Client errors (4xx) are answers, not outages: never retried (a v2 429 marked retryable is the one
 * exception). Network failures and 5xx are retried twice (TanStack's exponential backoff).
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const status = statusOf(error);
  const retryable = error instanceof V2ApiError && error.retryable;
  if (status !== null && status >= 400 && status < 500 && !retryable) return false;
  return failureCount < MAX_RETRIES;
}

/**
 * The app's single TanStack Query cache (plan 3.1, UX02). Per-resource stale times live in the hooks;
 * heavy reports also turn off refetch on window focus (`useReport`), lists and reports keep the previous
 * result while a new key loads (`use-v2-list.ts`, `reports.ts`).
 */
export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetryQuery, staleTime: DEFAULT_STALE_TIME_MS, gcTime: QUERY_GC_TIME_MS },
      mutations: { retry: false },
    },
  });
}
