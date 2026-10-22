import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { actAs } from '@/test/acting-user';
import { stubV2Fetch } from '@/test/v2-fetch';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { CodesAdminPage } = await import('./codes-admin-page');
const { RuleNewPage } = await import('./rules/rule-new-page');

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

// SETUP_UX_FIXES Phase 3: Codes & failures has one tab row (Code libraries · Rules · Failure dictionary)
describe('Codes & failures tab row', () => {
  beforeEach(() => {
    actAs('SuperAdmin');
    stubV2Fetch(() => undefined);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('the codes page shows one link row and no nested shadcn tabs; ?tab=rules keeps working', () => {
    show(<CodesAdminPage />, '/master-data/codes-rules?tab=rules', '/master-data/codes-rules');
    expect(within(row()).getAllByRole('link').map((link) => link.textContent)).toEqual(['Code libraries', 'Rules', 'Failure dictionary']);
    expect(within(row()).getByRole('link', { current: 'page' })).toHaveTextContent('Rules');
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getByTestId('codes-admin')).toHaveAttribute('data-tab', 'rules');
  });

  it('the new-rule page keeps the row (Rules highlighted) and a visible Back to Rules', () => {
    show(<RuleNewPage />, '/master-data/codes-rules/rules/new', '/master-data/codes-rules/rules/new');
    expect(within(row()).getByRole('link', { current: 'page' })).toHaveTextContent('Rules');
    expect(screen.getByTestId('page-back')).toHaveAttribute('href', '/master-data/codes-rules?tab=rules');
    expect(screen.getByTestId('page-back')).toHaveTextContent('Back to Rules');
  });
});
