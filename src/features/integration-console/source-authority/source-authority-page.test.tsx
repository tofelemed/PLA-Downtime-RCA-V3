import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { SourceAuthorityInForceView, SourceAuthorityVersionView } from '@/api/v2/types/source-authority';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/features/ux-kit/use-plant-timezone', () => ({ usePlantTimezone: () => ({ timezone: 'Asia/Tehran', source: 'tenant', loading: false }) }));

const { SourceAuthorityPage } = await import('./source-authority-page');

interface Call {
  method: string;
  url: URL;
  body: Record<string, unknown> | null;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const POLICY = {
  measurement: 'output',
  primarySource: 'pi_counter',
  fallback: null,
  measurementHierarchy: {
    boundary: 'reactor_outlet',
    conditions: ['primary_missing'],
    entries: [
      { rank: 2, sourceClass: 'redundant_measurement', source: 'pi_counter', signalSourceKey: 'FT-102.TOT', boundary: 'reactor_outlet' },
      { rank: 1, sourceClass: 'calibrated_primary', source: 'pi_counter', signalSourceKey: 'FT-101.TOT', boundary: 'reactor_outlet' },
    ],
  },
};

const IN_FORCE: SourceAuthorityInForceView = { policyId: 'p1', version: 1, unitId: null, effectiveFrom: '2026-01-01T00:00:00.000Z', notes: null, policy: { ...POLICY, measurementHierarchy: undefined } };

const DRAFT: SourceAuthorityVersionView = {
  id: 'v2',
  version: 2,
  unitId: 'unit-1',
  state: 'proposed',
  inForce: false,
  effectiveFrom: '2026-10-15T08:00:00.000Z',
  effectiveTo: null,
  basedOnId: 'p1',
  createdBy: 'author-1',
  createdAt: '2026-10-15T08:00:00.000Z',
  approvedBy: null,
  approvedAt: null,
  rejectedBy: null,
  rejectedAt: null,
  rejectionReason: null,
  notes: null,
  policy: POLICY,
};

const PLANT_DRAFT: SourceAuthorityVersionView = { ...DRAFT, id: 'v9', version: 9, unitId: null };

describe('source priority screen (maker-checker source authority)', () => {
  let calls: Call[];
  let refuseDraft = false;

  const renderPage = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <MemoryRouter>
          <SourceAuthorityPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    calls = [];
    refuseDraft = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        const call = { method: init.method ?? 'GET', url: new URL(url), body: init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null };
        calls.push(call);
        if (call.method === 'POST' && call.url.pathname.endsWith('/source-authority/versions')) {
          return refuseDraft ? json(422, { code: 'INVALID_POLICY', message: 'ranks are not unique' }) : json(201, DRAFT);
        }
        if (call.method === 'POST') return json(200, { ...DRAFT, state: 'approved', inForce: true });
        if (call.url.pathname.endsWith('/units')) return json(200, { items: [{ id: 'unit-1', name: 'HDPE line 1' }], nextCursor: null });
        if (call.url.pathname.endsWith('/source-authority')) return json(200, IN_FORCE);
        return json(200, { items: [DRAFT, PLANT_DRAFT], nextCursor: null });
      }),
    );
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin', 'user-1');
  });

  it('shows the version in force and the draft with its ranked sources; a reader cannot decide', async () => {
    actAs('viewer', 'viewer-1');
    renderPage();
    expect((await screen.findByTestId('authority-in-force')).textContent).toContain('plant-wide');
    const [card] = await screen.findAllByTestId('authority-version');
    expect(card.getAttribute('data-state')).toBe('proposed');
    expect(screen.getAllByTestId('authority-scope-badge').map((b) => b.textContent)).toEqual(['This unit', 'Whole plant']);
    expect(card.querySelector('ol')?.textContent).toMatch(/FT-101\.TOT.*FT-102\.TOT/);
    expect(screen.queryByTestId('authority-approve')).toBeNull();
    const list = calls.find((c) => c.url.pathname.endsWith('/source-authority/versions'))?.url.searchParams;
    expect([list?.get('unitId'), list?.get('includeTenantWide')]).toEqual(['unit-1', 'true']);
    expect(screen.queryByTestId('authority-new')).toBeNull();
  });

  it('the integration owner who can only draft gets no approve control', async () => {
    actAs('integration_admin', 'integration-1');
    renderPage();
    await screen.findAllByTestId('authority-version');
    expect(screen.queryByTestId('authority-approve')).toBeNull();
  });

  it('the author sees approval disabled (separation of duties)', async () => {
    actAs('production_accountant', 'author-1');
    renderPage();
    await screen.findAllByTestId('authority-version');
    expect(screen.getAllByTestId('sod-disabled')).toHaveLength(2);
  });

  it('production accounting approves a draft it did not write', async () => {
    actAs('production_accountant', 'checker-1');
    renderPage();
    const [, plantWide] = await screen.findAllByTestId('authority-approve');
    fireEvent.click(plantWide);
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')?.url.pathname).toMatch(/\/v2\/source-authority\/versions\/v9\/approve$/);
  });

  const draftFromScreen = async () => {
    actAs('integration_admin', 'integration-1');
    renderPage();
    fireEvent.click(await screen.findByTestId('authority-new'));
    fireEvent.change(await screen.findByTestId('authority-boundary'), { target: { value: 'reactor_outlet' } });
    fireEvent.change(screen.getByLabelText('Boundary of this source'), { target: { value: 'reactor_outlet' } });
    fireEvent.change(screen.getByTestId('authority-entry-signal-0'), { target: { value: 'FT-101.TOT' } });
  };

  it('the integration owner drafts a plant-wide version from the one in force', async () => {
    await draftFromScreen();
    fireEvent.change(screen.getByTestId('authority-scope'), { target: { value: 'plant' } });
    fireEvent.change(await screen.findByTestId('authority-boundary'), { target: { value: 'reactor_outlet' } });
    fireEvent.change(screen.getByLabelText('Boundary of this source'), { target: { value: 'reactor_outlet' } });
    fireEvent.click(screen.getByTestId('authority-save'));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.body).toMatchObject({
      measurementHierarchy: { boundary: 'reactor_outlet', conditions: ['primary_missing'], entries: [{ rank: 1, source: 'pi_counter', boundary: 'reactor_outlet' }] },
    });
    expect(post?.body && 'unitId' in post.body).toBe(false);
  });

  it("shows the server's refusal of a draft", async () => {
    refuseDraft = true;
    await draftFromScreen();
    fireEvent.click(screen.getByTestId('authority-save'));
    const refusal = await screen.findByTestId('refusal');
    expect(refusal.getAttribute('data-code')).toBe('INVALID_POLICY');
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ unitId: 'unit-1' });
  });
});
