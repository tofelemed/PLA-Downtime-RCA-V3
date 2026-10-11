import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { configureV2Session } from '@/api/v2/config';
import type { RcaCaseView, RcaOutcomeView } from '@/api/v2/types/rca';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { LinkRcaDialog } = await import('./link-dialog/link-rca-dialog');
const { OutcomePanel } = await import('./outcome-panel');
const { CaseEditor } = await import('./cases/case-editor');

interface Call {
  method: string;
  url: URL;
  body: Record<string, unknown> | null;
  headers: Headers;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const list = (items: unknown[]) => ({ items, nextCursor: null, asOf: '2026-10-10T00:00:00Z', scope: { tenantId: 'tenant-a' } });

const CASE: RcaCaseView = {
  id: 'c1', title: 'Pump trips', status: 'Draft', priority: 'High', unitId: 'u-1', assetId: null, teamLeadId: null,
  targetCloseDate: null, actualCloseDate: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', rowVersion: 4,
  description: null, teamMemberIds: [], rootCause: null, templateId: null,
  recommendations: [{ id: 'rec-1', title: 'Realign', description: null, priority: null, ownerId: null, dueDate: null, status: 'open' }],
  evidence: [], logicTree: [],
};

describe('RCA flows (plan 3.9)', () => {
  let calls: Call[];
  let reply: (call: Call) => Response;
  let client: QueryClient;
  const wrap = (node: ReactNode) => render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);

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
        return json(200, { kind: 'event', builtAt: '2026-10-10T00:00:00Z', revisions: [{}], causeCodes: { reasonCode: null, impactCode: null, failureMode: null }, recurrence: { windowDays: 90, sameAsset: 3, sameReason: null }, trendWindow: { from: '2026-10-09T00:00:00Z', to: '2026-10-09T02:00:00Z', signalIds: [] }, approvedImpact: { lines: 0, quantities: [], values: [], basis: 'b' } });
      }
      if (call.method === 'POST') return json(201, { created: true, caseCreated: false, link: {}, rca: { id: 'c1', title: 'Pump trips' } });
      return json(200, list([{ ...CASE }]));
    };
    const done = vi.fn();
    wrap(<LinkRcaDialog eventId="e1" timezone="UTC" context={{ assetId: 'a1', reasonCodeId: null, from: '2026-10-09T00:00:00Z', to: '2026-10-09T01:00:00Z' }} onClose={() => undefined} onDone={done} />);
    expect((await screen.findByTestId('evidence-recurrence')).textContent).toContain('same asset 3');
    const search = calls.find((call) => call.url.pathname.endsWith('/rcas'));
    expect(search?.url.searchParams.get('assetId')).toBe('a1');
    fireEvent.click(await screen.findByRole('option', { name: /Pump trips/ }));
    fireEvent.click(screen.getByTestId('link-rca-submit'));
    await waitFor(() => expect(done).toHaveBeenCalled());
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

  it('saves the case with If-Match and the nested items in the v2 body', async () => {
    reply = (call) => json(200, { ...CASE, rowVersion: 5, title: String(call.body?.title ?? CASE.title) });
    wrap(<CaseEditor rca={CASE} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Pump trips (P-101)' } });
    fireEvent.click(screen.getByTestId('save-case'));
    await screen.findByText('Saved.');
    const patch = calls.find((call) => call.method === 'PATCH');
    expect(patch?.url.pathname).toBe('/api/v2/rcas/c1');
    expect(patch?.headers.get('If-Match')).toBe('"4"');
    expect(patch?.body).toMatchObject({ title: 'Pump trips (P-101)', recommendations: [{ id: 'rec-1', title: 'Realign' }] });
    expect(patch?.body).not.toHaveProperty('tenantId');
  });

  describe('controls follow RCA_WRITERS (owner decision 2026-10-12)', () => {
    afterEach(() => actAs('SuperAdmin'));

    it('canWriteRca: a reliability engineer saves the case; a production engineer sees it read-only without save', () => {
      reply = () => json(200, {});
      actAs('reliability_engineer');
      const writer = wrap(<CaseEditor rca={CASE} />);
      expect(screen.getByTestId('save-case')).toBeTruthy();
      writer.unmount();
      actAs('Engineer');
      wrap(<CaseEditor rca={CASE} />);
      expect(screen.queryByTestId('save-case')).toBeNull();
      expect(screen.getByLabelText('Title')).toBeDisabled();
      expect(screen.queryByText('Add node')).toBeNull();
    });
  });
});
