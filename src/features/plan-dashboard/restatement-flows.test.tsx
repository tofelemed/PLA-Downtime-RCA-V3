import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import type { RestatementView } from '@/api/v2/types/restatement';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { RestatementPanel } = await import('./restatement/restatement-panel');
const { RestatedValueNote } = await import('./restatement/restated-value-note');

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
    const date = await screen.findByLabelText(/Posting date/);
    expect(date).toHaveAttribute('placeholder', 'YYYY-MM-DD');
    fireEvent.change(date, { target: { value: '2026-11-03' } });
    fireEvent.blur(date);
    // QA re-test: the treatment choices are sentence case
    expect([...screen.getByTestId('posting-treatment').querySelectorAll('option')].map((o) => o.textContent)).toEqual(['Correction', 'Change in estimate', 'Other adjustment', 'No posting']);
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

  it('QA Value note: the Value section names a restated loss value and links to the restatement', async () => {
    const restated: RestatementView = { ...DELTA, values: { oldView: 'contribution_margin', newView: 'contribution_margin', viewChanged: false, currencies: [{ currency: 'USD', old: '5040', new: '5250', delta: '210' }] } };
    vi.stubGlobal('fetch', vi.fn(async () => json(200, restated)));
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <RestatedValueNote view={VIEW} reviewHref="/plans/pl/periods/p1/review" />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const note = await screen.findByTestId('restated-value-note');
    expect(note).toHaveTextContent('Restated from approved revision 1: loss value was 5,040.00 USD, now 5,250.00 USD.');
    expect(screen.getByRole('link', { name: 'See the restatement in Review & close' })).toHaveAttribute('href', '/plans/pl/periods/p1/review#restatement');
  });

  it('QA Value note: nothing when the value did not change', async () => {
    const same: RestatementView = { ...DELTA, values: { oldView: 'contribution_margin', newView: 'contribution_margin', viewChanged: false, currencies: [{ currency: 'USD', old: '2250', new: '2250', delta: '0' }] } };
    vi.stubGlobal('fetch', vi.fn(async () => json(200, same)));
    const { container } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <RestatedValueNote view={VIEW} reviewHref="/r" />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled());
    expect(container.querySelector('[data-testid="restated-value-note"]')).toBeNull();
  });
});
