import { vi } from 'vitest';
import { configureV2Session } from '@/api/v2/config';

/** One request a component made, as the stubbed `fetch` saw it. */
export interface V2Call {
  method: string;
  url: URL;
  body: Record<string, unknown> | null;
  headers: Headers;
}

export const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** A v2 list envelope of one page. */
export const listPage = (items: unknown[], nextCursor: string | null = null) => ({
  items,
  nextCursor,
  asOf: '2026-10-10T00:00:00Z',
  scope: { tenantId: 'tenant-a' },
});

/** A v2 error envelope. */
export const errorBody = (code: string, message: string, details?: Record<string, unknown>) => ({
  code,
  message,
  correlationId: 'corr-1',
  retryable: false,
  ...(details ? { details } : {}),
});

/**
 * Stubs `fetch` for v2 component tests: every call is recorded and answered by `reply` (default: an empty
 * list page), and the v2 session acts for tenant `tenant-a`. Undo with `vi.unstubAllGlobals()`.
 */
export function stubV2Fetch(reply: (call: V2Call) => Response | undefined) {
  const calls: V2Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const call: V2Call = {
        method: init.method ?? 'GET',
        url: new URL(url, 'http://localhost'),
        body: init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null,
        headers: new Headers(init.headers),
      };
      calls.push(call);
      return reply(call) ?? jsonResponse(200, listPage([]));
    }),
  );
  configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  return calls;
}
