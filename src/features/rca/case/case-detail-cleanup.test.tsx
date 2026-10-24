import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { configureV2Session } from '@/api/v2/config';
import type { RcaCaseView } from '@/api/v2/types/rca';
import { actAs } from '@/test/acting-user';
import { CaseWorkspaceContext } from './case-context';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { LinksPage } = await import('./links/links-page');
const { HistoryPage } = await import('./history/history-page');
const { AnalysisIndexPage } = await import('./analysis/analysis-index-page');

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const list = { items: [], nextCursor: null, asOf: '2026-10-10T00:00:00Z', scope: { tenantId: 'tenant-a' } };

const CASE: RcaCaseView = {
  id: 'c1', title: 'Pump trips', status: 'Analysis', priority: 'High', unitId: 'u-1', assetId: null, teamLeadId: null,
  targetCloseDate: null, actualCloseDate: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', rowVersion: 4,
  description: null, teamMemberIds: [], rootCause: null, templateId: null, teamCharter: null, recommendations: [],
  evidence: [], logicTree: [], eventDiagram: { nodes: [], edges: [] },
  createdBy: 'u-author', consequenceClass: null, residualRisk: null, closureRequestedBy: null, closureRequestedAt: null,
  closureApprovedBy: null, closureApprovedAt: null, closureNote: null, effectivenessVerdict: null,
};

const wrap = (node: ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <CaseWorkspaceContext.Provider value={{ rca: CASE, readOnly: false, canWrite: true, closed: false, basePath: '/rca/c1' }}>{node}</CaseWorkspaceContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('investigation detail cleanup: section explanations sit behind the ⓘ', () => {
  beforeEach(() => {
    actAs('SuperAdmin', 'u-1');
    vi.stubGlobal('fetch', vi.fn(async () => json(list)));
    configureV2Session({ getAccessToken: () => 'a.b.c', getTenantId: () => 'tenant-a', refresh: async () => false, onSessionExpired: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('Links & outcome: no description paragraphs; the "never added up" rule is behind the Outcome ⓘ', () => {
    wrap(<LinksPage />);
    expect(screen.queryByText(/three separate figures, never added up/)).toBeNull();
    expect(screen.queryByText(/occurrences this investigation covers/)).toBeNull();
    expect(screen.getByRole('button', { name: 'About Outcome' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About Links' })).toBeInTheDocument();
  });

  it('History: no description; ⓘ next to the title', () => {
    wrap(<HistoryPage />);
    expect(screen.queryByText(/with who made it and when/)).toBeNull();
    expect(screen.getByRole('button', { name: 'About History' })).toBeInTheDocument();
  });

  it('Analysis methods: the instruction moves to the ⓘ; the link to the case definition stays', () => {
    wrap(<AnalysisIndexPage />);
    expect(screen.queryByText(/Use the methods that fit the problem/)).toBeNull();
    expect(screen.getByRole('button', { name: 'About Analysis methods' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Case definition' })).toHaveAttribute('href', '/rca/c1/definition');
  });
});
