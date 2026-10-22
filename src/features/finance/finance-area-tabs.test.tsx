import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { actAs } from '@/test/acting-user';
import { stubV2Fetch } from '@/test/v2-fetch';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { FinancePage } = await import('./finance-page');
const { PolicyNewPage } = await import('./policies/policy-new-page');

const show = (node: JSX.Element, path: string, route: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={node} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const row = () => screen.getByRole('navigation', { name: 'Pages of this setup area' });

// SETUP_UX_FIXES Phase 3: Valuation has one link row (no shadcn tabs), also on its sub-pages
describe('Valuation tab row', () => {
  beforeEach(() => {
    actAs('SuperAdmin');
    stubV2Fetch(() => undefined);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('the list page: Valuation policy · Exchange rates · Demand as links, the ?tab= one highlighted', () => {
    show(<FinancePage />, '/finance?tab=fx', '/finance');
    expect(within(row()).getAllByRole('link').map((link) => link.textContent)).toEqual(['Valuation policy', 'Exchange rates', 'Demand']);
    expect(within(row()).getByRole('link', { current: 'page' })).toHaveTextContent('Exchange rates');
    expect(screen.getByTestId('tab-fx-rates')).toHaveAttribute('href', '/finance?tab=fx');
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('a new policy version keeps the row and a visible Back to Valuation policy', () => {
    show(<PolicyNewPage />, '/finance/policies/new', '/finance/policies/new');
    expect(within(row()).getByRole('link', { current: 'page' })).toHaveTextContent('Valuation policy');
    expect(screen.getByTestId('page-back')).toHaveAttribute('href', '/finance?tab=policies');
  });
});
