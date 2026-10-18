import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import { actAs } from '@/test/acting-user';
import { readStartRca, startRcaHref } from './model/start-rca';
import { badActorStartRca } from './bad-actors/bad-actor-model';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { NewCasePage } = await import('./pages/new-case-page');
const { EventCaseSection } = await import('./pages/event-case-section');
const { StartRcaLink } = await import('./components/start-rca-link');

interface Call {
  method: string;
  url: URL;
  body: Record<string, unknown> | null;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const list = (items: unknown[]) => ({ items, nextCursor: null, asOf: '2026-10-18T00:00:00Z', scope: { tenantId: 'tenant-a' } });
const EVIDENCE = {
  kind: 'event', builtAt: '2026-10-18T00:00:00Z', event: { unitId: 'u-1', assetId: 'a1', start: '2026-10-17T00:00:00Z', end: '2026-10-17T01:00:00Z' },
  revisions: [{}], causeCodes: { reasonCode: null, impactCode: null, failureMode: null }, recurrence: { windowDays: 90, sameAsset: 1, sameReason: null },
  trendWindow: { from: '2026-10-17T00:00:00Z', to: '2026-10-17T02:00:00Z', signalIds: [] }, approvedImpact: { lines: 0, quantities: [], values: [], basis: 'b' },
};

describe('Start RCA from where the loss is seen (item 4)', () => {
  let calls: Call[];
  let reply: (call: Call) => Response;
  let client: QueryClient;
  const wrap = (node: ReactNode, entry = '/') =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/rca/new" element={node} />
            <Route path="/rca/:caseId" element={<p data-testid="case-opened" />} />
            <Route path="*" element={node} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    actAs('SuperAdmin');
    calls = [];
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const call = { method: init.method ?? 'GET', url: new URL(url), body: init.body ? JSON.parse(String(init.body)) : null };
      calls.push(call);
      return reply(call);
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('carries event, loss line and prefill in the URL and reads them back clipped', () => {
    const href = startRcaHref({ eventId: 'e1', lossLineId: 'l1', title: '  Bad actor: P-101 ', description: '' });
    expect(href).toBe('/rca/new?eventId=e1&lossLineId=l1&title=Bad+actor%3A+P-101');
    expect(readStartRca(new URLSearchParams(href.split('?')[1]))).toEqual({ eventId: 'e1', lossLineId: 'l1', unitId: null, title: 'Bad actor: P-101', description: null });
    expect(startRcaHref({})).toBe('/rca/new');
  });

  it('prefills a bad-actor case with the asset, its failure mode and unit', () => {
    const context = badActorStartRca({
      rank: 2, key: 'k', assetId: 'a1', assetCode: 'P-101', assetName: 'Feed pump', unitId: 'u-1', failureMode: 'mode:seal leak',
      stops: 4, downtimeSeconds: '3600', quantities: [], quantity: null, value: null,
      trigger: { state: 'fired', seconds: 3600, thresholdSeconds: 1800, windowDays: 30, criticalAsset: false, firedAt: null, rcaId: null, outcome: null },
    });
    expect(context).toMatchObject({ unitId: 'u-1', title: 'Bad actor: P-101 Feed pump (seal leak)' });
  });

  it('is offered only to RCA writers', () => {
    actAs('viewer');
    const { container } = wrap(<StartRcaLink context={{ lossLineId: 'l1' }} />);
    expect(container.querySelector('[data-testid="start-rca"]')).toBeNull();
  });

  it('creates a prefilled case and links the loss line before opening it', async () => {
    reply = (call) => {
      if (call.method === 'POST' && call.url.pathname === '/api/v2/rcas') return json(201, { id: 'c9', title: 'Recurring downtime' });
      if (call.method === 'POST') return json(201, { created: true, link: {}, rca: { id: 'c9', title: 'Recurring downtime' } });
      return json(200, list([]));
    };
    wrap(<NewCasePage />, '/rca/new?lossLineId=l1&title=Recurring+downtime');
    expect(screen.getByLabelText('Title')).toHaveValue('Recurring downtime');
    fireEvent.click(screen.getByTestId('create-case'));
    expect(await screen.findByTestId('case-opened')).toBeInTheDocument();
    const link = calls.find((call) => call.url.pathname === '/api/v2/rcas/c9/links');
    expect(link?.body).toEqual({ linkType: 'loss_line', targetId: 'l1', reason: 'Started from the loss line' });
  });

  it('keeps the page with a way into the case when the loss line link is refused', async () => {
    reply = (call) => {
      if (call.method === 'POST' && call.url.pathname === '/api/v2/rcas') return json(201, { id: 'c9', title: 'T' });
      if (call.method === 'POST') return json(422, { code: 'INVALID_REFERENCE', message: 'targetId' });
      return json(200, list([]));
    };
    wrap(<NewCasePage />, '/rca/new?lossLineId=l1&title=T');
    fireEvent.click(screen.getByTestId('create-case'));
    expect(await screen.findByTestId('loss-line-link-failed')).toHaveTextContent('could not be linked');
    expect(screen.getByRole('link', { name: 'Open the investigation' })).toHaveAttribute('href', '/rca/c9');
  });

  it('links the loss line after linking its cause event to the new case', async () => {
    reply = (call) => {
      if (call.url.pathname.endsWith('/rca-evidence')) return json(200, EVIDENCE);
      if (call.url.pathname.endsWith('/similar')) return json(200, []);
      if (call.method === 'POST') return json(201, { created: true, caseCreated: true, link: {}, rca: { id: 'c7', title: 'Stop' } });
      return json(200, list([]));
    };
    wrap(<EventCaseSection eventId="e1" lossLineId="l1" />);
    await screen.findByTestId('evidence-recurrence');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Stop' } });
    fireEvent.click(screen.getByTestId('link-rca-submit'));
    await waitFor(() => expect(calls.some((call) => call.url.pathname === '/api/v2/rcas/c7/links')).toBe(true));
    const posts = calls.filter((call) => call.method === 'POST').map((call) => call.url.pathname);
    expect(posts).toEqual(['/api/v2/production-events/e1/rca-link', '/api/v2/rcas/c7/links']);
  });
});
