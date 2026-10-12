import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { RcaKnowledgeSimilarView, RcaKnowledgeView } from '@/api/v2/types/rca-knowledge';
import { actAs } from '@/test/acting-user';
import { canPublishKnowledge, EMPTY_FILTERS, filtersFromParams, paramsFromFilters, toKnowledgeQuery } from './model/knowledge-filters';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { RcaKnowledgePage } = await import('./rca-knowledge-page');
const { KnowledgeDetail } = await import('./components/knowledge-detail');
const { SimilarKnowledgePanel } = await import('./similar-knowledge-panel');

interface Call {
  method: string;
  url: URL;
  body: Record<string, unknown> | null;
  headers: Headers;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const list = (items: unknown[]) => ({ items, nextCursor: null, asOf: '2026-10-12T00:00:00Z', scope: { tenantId: 'tenant-a' } });

const ENTRY: RcaKnowledgeView = {
  id: 'k1', rowVersion: 3, title: 'Extruder coupling failures', description: 'Trips on vibration', problemStatement: null,
  rootCause: 'Coupling misalignment', rootCauseCategory: null, category: null, unitId: 'u1', unitName: 'Extruder line',
  assetId: 'a1', assetName: 'Extruder', rcaId: 'c1', caseTitle: 'Extruder coupling failures', caseStatus: 'Closed',
  recommendations: ['Align the coupling'], actionsSummary: { recommendations: 1, actions: 2, done: 1, cancelled: 0 },
  helpfulCount: 2, notHelpfulCount: 0, myVote: null, isPublished: false, publishedAt: null, publishedBy: null, author: 'u-9',
  closedAt: '2026-10-01T00:00:00Z', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', qualityScore: 77,
  quality: [{ factor: 'rootCause', points: 30, max: 30 }, { factor: 'feedback', points: 10, max: 10 }],
};

describe('model', () => {
  it('maps the filter bar to the server query and leaves "all" out', () => {
    expect(toKnowledgeQuery(EMPTY_FILTERS, '  ')).toEqual({ q: undefined, unitId: undefined, reasonCodeId: undefined, published: undefined });
    expect(toKnowledgeQuery({ text: 'x', unitId: 'u1', reasonCodeId: 'r1', published: 'unpublished' }, ' seal ')).toEqual({
      q: 'seal', unitId: 'u1', reasonCodeId: 'r1', published: false,
    });
  });

  it('lets RCA writers (and global admins) publish, nobody else', () => {
    expect(canPublishKnowledge(['reliability_engineer'])).toBe(true);
    expect(canPublishKnowledge(['TenantAdmin', 'manager_approver'])).toBe(true);
    expect(canPublishKnowledge(['SuperAdmin'])).toBe(true);
    expect(canPublishKnowledge(['Engineer', 'production_engineer'])).toBe(false);
    expect(canPublishKnowledge(['Operator', 'operator'])).toBe(false);
  });
});

describe('RCA knowledge base v2 screen', () => {
  let calls: Call[];
  let reply: (call: Call) => Response;
  let client: QueryClient;
  const wrap = (node: ReactNode) =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>{node}</MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    calls = [];
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url: new URL(url), body: init.body ? JSON.parse(String(init.body)) : null, headers: new Headers(init.headers) };
      calls.push(call);
      return reply(call);
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin');
  });

  const knowledgeCalls = () => calls.filter((call) => call.url.pathname === '/api/v2/rca-knowledge');

  it('maps the URL filters both ways (Back and links keep them)', () => {
    const state = filtersFromParams(new URLSearchParams('q=seal&published=published&unitId=all'));
    expect(state).toEqual({ text: 'seal', unitId: 'all', reasonCodeId: 'all', published: 'published' });
    expect(paramsFromFilters(state)).toEqual({ q: 'seal', published: 'published' });
  });

  it('lists server pages and sends the search text to the server (no browser filtering)', async () => {
    reply = (call) => json(200, list(call.url.pathname === '/api/v2/rca-knowledge' ? [ENTRY] : []));
    wrap(<RcaKnowledgePage />);
    expect(await screen.findByText('Extruder coupling failures')).toBeTruthy();
    expect(screen.getByTestId('quality-score').textContent).toBe('Quality 77');
    expect(knowledgeCalls()[0].url.searchParams.get('limit')).toBe('20');
    fireEvent.change(screen.getByLabelText('Search knowledge entries'), { target: { value: 'coupling' } });
    await waitFor(() => expect(knowledgeCalls().some((call) => call.url.searchParams.get('q') === 'coupling')).toBe(true));
  });

  it('shows the server score breakdown, votes once and publishes with If-Match', async () => {
    reply = (call) => {
      if (call.method === 'POST') return json(200, { ...ENTRY, rowVersion: 4, isPublished: true, myVote: 'helpful', helpfulCount: 3 });
      return json(200, ENTRY);
    };
    actAs('reliability_engineer');
    wrap(<KnowledgeDetail id="k1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Quality' }));
    expect((await screen.findByTestId('quality-breakdown')).textContent).toContain('30 / 30');
    fireEvent.click(screen.getByRole('button', { name: /^Helpful/ }));
    await waitFor(() => expect(calls.some((call) => call.url.pathname.endsWith('/votes'))).toBe(true));
    const vote = calls.find((call) => call.url.pathname.endsWith('/votes'));
    expect(vote?.body).toEqual({ helpful: true });
    expect(vote?.headers.get('Idempotency-Key')).toBeTruthy();
    fireEvent.click(screen.getByTestId('knowledge-publish'));
    await waitFor(() => expect(calls.some((call) => call.url.pathname.endsWith('/publish'))).toBe(true));
    const publish = calls.find((call) => call.url.pathname.endsWith('/publish'));
    expect(publish?.headers.get('If-Match')).toBe('"3"');
  });

  it('hides publish for an engineer and every write for a viewer', async () => {
    reply = () => json(200, ENTRY);
    actAs('Engineer');
    const first = wrap(<KnowledgeDetail id="k1" />);
    expect(await screen.findByTestId('knowledge-detail')).toBeTruthy();
    expect(screen.queryByTestId('knowledge-publish')).toBeNull();
    expect(screen.getByRole('button', { name: /^Helpful/ })).toBeTruthy();
    first.unmount();
    actAs('viewer');
    wrap(<KnowledgeDetail id="k1" />);
    expect(await screen.findByTestId('knowledge-detail')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Helpful/ })).toBeNull();
    expect(screen.queryByTestId('knowledge-publish')).toBeNull();
  });

  it('lists similar past RCAs of an event with what matched', async () => {
    const similar: RcaKnowledgeSimilarView = { ...ENTRY, matchedOn: ['asset', 'reason'], relevance: 5 };
    reply = () => json(200, [similar]);
    wrap(<SimilarKnowledgePanel eventId="e1" />);
    const link = await screen.findByRole('link', { name: 'Extruder coupling failures' });
    expect(link.getAttribute('href')).toBe('/rca-knowledge-base/k1');
    expect(screen.getByText('same asset')).toBeTruthy();
    expect(calls[0].url.pathname).toBe('/api/v2/rca-knowledge/similar');
    expect(calls[0].url.searchParams.get('eventId')).toBe('e1');
  });
});
