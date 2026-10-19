import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureV2Session } from '@/api/v2/config';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import type { RestatementView } from '@/api/v2/types/restatement';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { RestatementPanel } = await import('./restatement/restatement-panel');

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const VIEW = {
  periodId: 'p1',
  revision: { revision: 2, supersedesId: 'rev-1', lifecycle: 'draft' },
} as unknown as ReconciliationView;

const DELTA: RestatementView = {
  periodId: 'p1', revision: 2, lifecycle: 'draft', afterClose: true, supersededRevision: 1, operationalEffectiveDate: '2026-10-08', posting: null,
  totals: [{ uom: 't', figures: { actual: { old: '100', new: '95', delta: '-5' } } }],
  actuals: [{ uom: 't', figures: { good: { old: '100', new: '95', delta: '-5' }, gross: { old: '100', new: '100', delta: '0' } } }],
  lines: [{ kind: 'quality', reasonCodeId: null, uom: 't', old: '0', new: '5', delta: '5' }],
};

describe('restatement delta and posting (SME R5)', () => {
  let posts: Array<{ url: URL; body: unknown }>;
  beforeEach(() => {
    posts = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (init.method === 'POST') {
        posts.push({ url: new URL(url), body: JSON.parse(String(init.body)) });
        return json(200, { ...DELTA, posting: { postingDate: '2026-11-03', treatment: 'correction', note: null, decidedBy: 'f1', decidedAt: '2026-11-03T08:00:00.000Z' } });
      }
      return json(200, DELTA);
    }));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    actAs('SuperAdmin', 'user-1');
  });

  const wrap = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <RestatementPanel view={VIEW} />
      </QueryClientProvider>,
    );

  it('shows old vs new from the server; plant management cannot set the posting', async () => {
    actAs('manager_approver', 'm1');
    wrap();
    const table = await screen.findByTestId('restatement-delta');
    expect(table.textContent).toContain('Good production');
    expect(table.textContent).toContain('-5');
    expect(screen.getByTestId('restatement-panel').textContent).toContain('correction after month close');
    expect(screen.queryByTestId('posting-form')).toBeNull();
  });

  it('finance sets the posting date and treatment', async () => {
    actAs('finance_approver', 'f1');
    wrap();
    fireEvent.change(await screen.findByTestId('posting-date'), { target: { value: '2026-11-03' } });
    fireEvent.click(screen.getByTestId('posting-save'));
    expect(posts).toHaveLength(0);
    fireEvent.click(await screen.findByRole('button', { name: 'Save posting' }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0].url.pathname).toMatch(/\/v2\/production-periods\/p1\/revisions\/2\/posting$/);
    expect(posts[0].body).toEqual({ postingDate: '2026-11-03', treatment: 'correction' });
  });

  it('a decided posting is read-only and says who decided it and when', async () => {
    actAs('finance_approver', 'f1');
    const decided: RestatementView = {
      ...DELTA,
      posting: { postingDate: '2026-11-03', treatment: 'correction', note: null, decidedBy: 'f2', decidedByName: 'Kamran', decidedAt: '2026-11-03T08:00:00.000Z' },
    };
    vi.stubGlobal('fetch', vi.fn(async () => json(200, decided)));
    wrap();
    const text = await screen.findByTestId('posting-decided');
    expect(text.textContent).toContain('decided by Kamran');
    expect(text.textContent).toContain('a correction');
    expect(screen.queryByTestId('posting-form')).toBeNull();
    expect(screen.queryByTestId('posting-save')).toBeNull();
    expect(screen.getByTestId('posting-final').textContent).toContain('propose a correction');
  });

  it('a value-only restatement shows the loss value before and after (default view per side)', async () => {
    actAs('manager_approver', 'm1');
    const valueOnly: RestatementView = {
      ...DELTA,
      totals: [{ uom: 't', figures: { actual: { old: '189', new: '189', delta: '0' } } }],
      actuals: [],
      lines: [],
      values: {
        oldView: 'economic_impact',
        newView: 'contribution_margin',
        viewChanged: true,
        currencies: [
          { currency: 'USD', old: '5040', new: '5250', delta: '210' },
          { currency: 'IRR', old: '3024000000', new: '3150000000', delta: '126000000' },
        ],
      },
    };
    vi.stubGlobal('fetch', vi.fn(async () => json(200, valueOnly)));
    wrap();
    const rows = await screen.findAllByTestId('restatement-value');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Loss value (Economic impact (lost sales + incremental costs) → Contribution margin)');
    expect(rows[0].textContent).toContain('5,040.00 USD');
    expect(rows[0].textContent).toContain('5,250.00 USD');
    expect(rows[0].textContent).toContain('210.00 USD');
  });
});
