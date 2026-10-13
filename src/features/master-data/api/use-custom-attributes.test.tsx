import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { configureV2Session } from '@/api/v2/config';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: { user: { id: 'u1' }, tenant: { id: 'plant-a' } } }) }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { useCustomAttributes, useSetCustomAttribute } = await import('./use-custom-attributes');

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const definition = (id: string, isActive: boolean) => ({ id, entityType: 'Unit', name: id, displayName: id.toUpperCase(), dataType: 'string', isActive });

describe('custom attributes on v2 (V3 of the v2-only plan)', () => {
  let client: QueryClient;
  let calls: Array<{ url: URL; method: string; body: unknown }>;
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

  beforeEach(() => {
    calls = [];
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'plant-a', refresh: async () => false, onSessionExpired: () => undefined });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const parsed = new URL(url);
      calls.push({ url: parsed, method: init.method ?? 'GET', body: init.body ? JSON.parse(String(init.body)) : null });
      if (parsed.pathname.endsWith('/custom-attribute-definitions')) {
        return json({ items: [definition('room', true), definition('old', false)], nextCursor: null });
      }
      if ((init.method ?? 'GET') === 'PUT') return json({ attributeDefinitionId: 'room', value: 'B', updatedAt: 'now' });
      return json([{ attributeDefinitionId: 'room', value: 'North', updatedAt: 'now' }]);
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('reads active definitions and the record values from /v2; sets a value with PUT', async () => {
    const { result } = renderHook(() => ({ rows: useCustomAttributes('Unit', 'unit-1'), set: useSetCustomAttribute('Unit', 'unit-1') }), { wrapper });
    await waitFor(() => expect(result.current.rows.data).toBeDefined());
    expect(result.current.rows.data).toEqual([{ definition: expect.objectContaining({ id: 'room' }), value: 'North' }]);
    expect(calls.map((call) => call.url.pathname)).toEqual(expect.arrayContaining([expect.stringMatching(/\/v2\/custom-attribute-definitions$/), expect.stringMatching(/\/v2\/custom-attribute-values$/)]));
    await act(() => result.current.set.mutateAsync({ definitionId: 'room', value: 'B' }));
    const put = calls.find((call) => call.method === 'PUT');
    expect(put?.body).toEqual({ entityType: 'Unit', entityId: 'unit-1', attributeDefinitionId: 'room', value: 'B' });
  });
});
