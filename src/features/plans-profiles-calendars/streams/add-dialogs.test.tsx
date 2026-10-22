import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { actAs } from '@/test/acting-user';
import { jsonResponse, listPage, stubV2Fetch } from '@/test/v2-fetch';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const REFS = {
  timezone: 'Asia/Tehran',
  timezoneIsFallback: false,
  unitOptions: [{ value: 'u1', label: 'Unit 1' }],
  productOptions: [{ value: 'p1', label: 'HDPE (P1)' }],
  siteOptions: [],
  defaultSiteId: null,
  unitName: () => 'Unit 1',
  productName: () => 'HDPE',
  loading: false,
};
vi.mock('../hooks/use-planning-refs', () => ({ usePlanningRefs: () => REFS }));

const { StreamRunsPanel } = await import('./stream-runs-panel');
const { UnitStreamsTab } = await import('./unit-streams-tab');
const { TransitionStandardsTab } = await import('../profiles/transition-standards-tab');

const wrap = (node: ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={['/setup/profiles?unitId=u1']}>{node}</MemoryRouter>
    </QueryClientProvider>,
  );

describe('Add buttons open dialogs, never inline forms (SETUP_UX_FIXES Phase 4)', () => {
  beforeEach(() => {
    actAs('SuperAdmin');
    stubV2Fetch((call) => (call.method === 'GET' ? jsonResponse(200, listPage([])) : undefined));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('Add transition standard opens the form in a dialog; Cancel closes it', async () => {
    wrap(<TransitionStandardsTab />);
    expect(screen.queryByTestId('transition-standard-form')).toBeNull();
    fireEvent.click(screen.getByTestId('transition-standard-new'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('transition-standard-form')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Add stream opens the form in a dialog', async () => {
    wrap(<UnitStreamsTab />);
    expect(screen.queryByTestId('unit-stream-form')).toBeNull();
    fireEvent.click(screen.getByTestId('unit-stream-new'));
    expect(within(await screen.findByRole('dialog')).getByTestId('unit-stream-form')).toBeInTheDocument();
  });

  it('Record run opens the form in a dialog', async () => {
    wrap(<StreamRunsPanel unitId="u1" refs={REFS} streamOptions={[{ value: 'A', label: 'A' }]} canWrite />);
    expect(screen.queryByTestId('stream-run-form')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Record run/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('stream-run-form')).toBeInTheDocument();
  });
});
