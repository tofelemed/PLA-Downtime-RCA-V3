import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { RcaCaseView, RcaOutcomeView } from '@/api/v2/types/rca';
import { actAs } from '@/test/acting-user';
import { CaseWorkspaceContext } from './case/case-context';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { EventCaseSection } = await import('./pages/event-case-section');
const { OutcomePanel } = await import('./outcome-panel');
const { OverviewPage } = await import('./case/overview/overview-page');
const { FiveWhyTool } = await import('./case/analysis/tools/five-why/five-why-tool');

interface Call {
  method: string;
  url: URL;
  body: Record<string, unknown> | null;
  headers: Headers;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const list = (items: unknown[]) => ({ items, nextCursor: null, asOf: '2026-10-10T00:00:00Z', scope: { tenantId: 'tenant-a' } });
const NO_ANALYSES = { fiveWhy: null, fishbone: null, fmea: null, faultTree: null, barrier: null, change: null };

const CASE: RcaCaseView = {
  id: 'c1', title: 'Pump trips', status: 'Draft', priority: 'High', unitId: 'u-1', assetId: null, teamLeadId: null,
  targetCloseDate: null, actualCloseDate: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', rowVersion: 4,
  description: 'Trips after the seal change', teamMemberIds: [], rootCause: null, templateId: null, teamCharter: null,
  recommendations: [{ id: 'rec-1', title: 'Realign', description: null, priority: null, ownerId: null, dueDate: null, status: 'Open', estimatedCost: null }],
  evidence: [], logicTree: [], eventDiagram: { nodes: [], edges: [] },
};

describe('RCA flows (v2 case workspace)', () => {
  let calls: Call[];
  let reply: (call: Call) => Response;
  let client: QueryClient;
  const wrap = (node: ReactNode, readOnly = false) =>
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <CaseWorkspaceContext.Provider value={{ rca: CASE, readOnly, basePath: '/rca/c1' }}>{node}</CaseWorkspaceContext.Provider>
        </MemoryRouter>
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
  afterEach(() => vi.unstubAllGlobals());

  it('links an event to an existing case found by asset, with the evidence preview, as a §15.2 command', async () => {
    reply = (call) => {
      if (call.url.pathname.endsWith('/rca-evidence')) {
        return json(200, { kind: 'event', builtAt: '2026-10-10T00:00:00Z', event: { unitId: 'u-1', assetId: 'a1', start: '2026-10-09T00:00:00Z', end: '2026-10-09T01:00:00Z' }, revisions: [{}], causeCodes: { reasonCode: null, impactCode: null, failureMode: null }, recurrence: { windowDays: 90, sameAsset: 3, sameReason: null }, trendWindow: { from: '2026-10-09T00:00:00Z', to: '2026-10-09T02:00:00Z', signalIds: [] }, approvedImpact: { lines: 0, quantities: [], values: [], basis: 'b' } });
      }
      if (call.method === 'POST') return json(201, { created: true, caseCreated: false, link: {}, rca: { id: 'c1', title: 'Pump trips' } });
      if (call.url.pathname.endsWith('/similar')) return json(200, []);
      return json(200, list([{ ...CASE }]));
    };
    wrap(<EventCaseSection eventId="e1" />);
    expect((await screen.findByTestId('evidence-recurrence')).textContent).toContain('same asset 3');
    fireEvent.click(screen.getByLabelText('Add to an existing case'));
    fireEvent.click(await screen.findByRole('option', { name: /Pump trips/ }));
    const search = calls.find((call) => call.url.pathname.endsWith('/rcas'));
    expect(search?.url.searchParams.get('assetId')).toBe('a1');
    fireEvent.click(screen.getByTestId('link-rca-submit'));
    await waitFor(() => expect(calls.some((call) => call.method === 'POST')).toBe(true));
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.url.pathname).toBe('/api/v2/production-events/e1/rca-link');
    expect(post?.body).toEqual({ rcaId: 'c1' });
    expect(post?.headers.get('Idempotency-Key')).toBeTruthy();
  });

  it('shows approved, claimed and realized as three separate figures (never summed)', async () => {
    const outcome: RcaOutcomeView = {
      rcaId: 'c1',
      approvedHistoricalLoss: { lines: 2, quantities: [{ kind: 'availability', uom: 't', quantity: '150' }], values: [{ currency: 'USD', amount: null, valuedLines: 0, unvaluedLines: 2 }], basis: 'b' },
      claimedAvoided: [{ currency: 'USD', amount: '1000', actions: 1 }],
      realized: [{ actionId: 'a1', title: 'Realign', metric: 'recurrences', expected: '3', observed: '1', difference: '2' }],
      note: 'separate',
    };
    reply = () => json(200, outcome);
    wrap(<OutcomePanel rcaId="c1" />);
    expect((await screen.findByTestId('approved-impact')).textContent).toContain('Not valued');
    expect(screen.getByTestId('outcome-claimed').textContent).toContain('1,000.00');
    expect(screen.getByTestId('outcome-realized').textContent).toContain('Realign: 2 recurrences');
  });

  it('saves the definition with If-Match and only the declared scalar fields', async () => {
    reply = (call) => (call.method === 'PATCH' ? json(200, { ...CASE, rowVersion: 5 }) : json(200, call.url.pathname.endsWith('/analyses') ? NO_ANALYSES : list([])));
    wrap(<OverviewPage />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Pump trips (P-101)' } });
    fireEvent.click(screen.getByTestId('save-case'));
    await screen.findByText('Saved.');
    const patch = calls.find((call) => call.method === 'PATCH');
    expect(patch?.url.pathname).toBe('/api/v2/rcas/c1');
    expect(patch?.headers.get('If-Match')).toBe('"4"');
    expect(patch?.body).toMatchObject({ title: 'Pump trips (P-101)', teamCharter: null });
    expect(patch?.body).not.toHaveProperty('recommendations');
    expect(patch?.body).not.toHaveProperty('tenantId');
  });

  it('saves the first 5-Why without If-Match and copies its root cause to the case', async () => {
    reply = (call) => {
      if (call.method === 'PUT') return json(200, { id: 'fw1', rowVersion: 1, updatedAt: '2026-10-11T00:00:00Z', ...call.body });
      if (call.method === 'PATCH') return json(200, { ...CASE, rowVersion: 5, rootCause: 'Seal' });
      return json(200, NO_ANALYSES);
    };
    wrap(<FiveWhyTool />);
    fireEvent.change(await screen.findByLabelText('Answer (cause found)'), { target: { value: 'Seal leak' } });
    fireEvent.change(screen.getByLabelText('Root cause'), { target: { value: 'Seal' } });
    fireEvent.click(screen.getByTestId('save-tool'));
    await screen.findByText('Saved.');
    const put = calls.find((call) => call.method === 'PUT');
    expect(put?.url.pathname).toBe('/api/v2/rcas/c1/analyses/five-why');
    expect(put?.headers.get('If-Match')).toBeNull();
    expect(put?.body).toMatchObject({ problem: CASE.description, rootCause: 'Seal', whyLevels: [{ level: 1, answer: 'Seal leak' }] });
    expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({ rootCause: 'Seal' });
  });

  describe('controls follow RCA_WRITERS', () => {
    afterEach(() => actAs('SuperAdmin'));

    it('a read-only user sees the definition without save', () => {
      reply = () => json(200, NO_ANALYSES);
      actAs('Engineer');
      wrap(<OverviewPage />, true);
      expect(screen.queryByTestId('save-case')).toBeNull();
      expect(screen.getByLabelText('Title')).toBeDisabled();
    });
  });
});
