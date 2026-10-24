import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { actAs } from '@/test/acting-user';
import { jsonResponse, listPage, stubV2Fetch } from '@/test/v2-fetch';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/api/v2/queries/use-v2-tenant', () => ({ useV2TenantId: () => 'tenant-a' }));
vi.mock('@/features/ux-kit/use-plant-timezone', () => ({ usePlantTimezone: () => ({ timezone: 'Asia/Tehran', source: 'plant' }) }));

const { FinancePage } = await import('./finance-page');
const { FxRateDetailPage } = await import('./fx/fx-rate-detail-page');

const VERSION = { createdBy: 'author-1', approvedBy: null, approvedAt: null, rowVersion: 1, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' };
const policy = (approved: boolean) => ({
  id: 'p2', version: 2, approved, approvedBy: null, approvedAt: null, effectiveFrom: '2026-10-17T02:30:00.000Z', effectiveTo: null,
  body: { defaultBasis: 'contribution_margin' }, reportingCurrencies: ['IRR', 'USD'], notes: null, createdBy: 'author-1', createdAt: '2026-10-10T00:00:00.000Z',
});
const FX = {
  ...VERSION, id: 'f1', rateType: 'economic', fromCurrency: 'USD', toCurrency: 'IRR', rate: '600000', source: 'CBI', provisional: true, version: 1, state: 'draft',
  effectiveFrom: '2026-10-01T00:00:00.000Z', effectiveTo: '2026-11-01T00:00:00.000Z',
};

function open(at: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/finance/fx/:fxId" element={<FxRateDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const footerLabels = (dialog: HTMLElement) => within(dialog).getAllByRole('button').filter((b) => /^(Cancel|Save draft)$/.test(b.textContent ?? '')).map((b) => b.textContent);

describe('Valuation cleanup', () => {
  let approved: boolean;
  beforeEach(() => {
    actAs('SuperAdmin', 'someone-else');
    approved = true;
    stubV2Fetch((call) => {
      if (call.method !== 'GET') return undefined;
      const path = call.url.pathname;
      if (path.endsWith('/valuation-policies')) return jsonResponse(200, listPage([policy(approved)]));
      if (path.endsWith('/fx-rates/f1')) return jsonResponse(200, FX);
      if (path.endsWith('/fx-rates')) return jsonResponse(200, listPage([FX]));
      return undefined;
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('no description or zone line; the revaluation note is an ⓘ beside the title; the profile valuation-rates link is beside it', async () => {
    open('/finance');
    await screen.findByTestId('policy-row');
    expect(screen.queryByText(/Times in/)).toBeNull();
    expect(screen.queryByText(/An approval queues a recalculation/)).toBeNull();
    expect(screen.queryByText(/are kept on each production profile:/)).toBeNull();
    const header = screen.getByRole('heading', { level: 1 }).closest('header') as HTMLElement;
    expect(within(header).getByTestId('recalculation-notice')).toBeInTheDocument();
    expect(within(header).getByTestId('valuation-rates-link')).toHaveAttribute('href', '/setup/profiles');
    expect(within(header).getByTestId('policy-new')).toBeInTheDocument();
  });

  it('policies: a titled card; an approved policy is an ⓘ, not a banner', async () => {
    open('/finance');
    await screen.findByTestId('policy-row');
    expect(screen.getByRole('heading', { level: 2, name: 'Valuation policy versions' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('policy-banner')).toHaveAttribute('data-approved', 'true'));
    expect(screen.queryByText('A valuation policy version is approved')).toBeNull();
  });

  it('policies: without an approved version the warning stays visible', async () => {
    approved = false;
    open('/finance');
    expect(await screen.findByText(/No approved valuation policy/)).toBeInTheDocument();
    expect(screen.getByTestId('policy-banner')).toHaveAttribute('data-approved', 'false');
  });

  it('exchange rates: stacked h-9 filters, a titled card; the add dialog has an ⓘ, h-9 plant-clock dates without the zone, Cancel then Save draft', async () => {
    open('/finance?tab=fx');
    await screen.findByTestId('fx-row');
    expect(screen.getByLabelText('Currencies')).toHaveClass('h-9');
    expect(screen.getByRole('heading', { level: 2, name: 'Exchange rates' })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('fx-new'));
    const dialog = await screen.findByRole('dialog', { name: 'New exchange rate draft' });
    expect(within(dialog).queryByText(/approves the draft before valuation uses it/)).toBeNull();
    expect(within(dialog).queryByText(/Which conversion basis/)).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'About this entry' })).toBeInTheDocument();
    expect(within(dialog).queryByText(/Asia\/Tehran/)).toBeNull();
    expect(within(dialog).getByLabelText('Valid from date')).toHaveClass('h-9');
    expect(within(dialog).getByLabelText('Valid from time')).toHaveClass('h-9');
    await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByLabelText('Rate table')));
    expect(footerLabels(dialog)).toEqual(['Cancel', 'Save draft']);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('demand: a titled card; the add dialog has an ⓘ instead of a description and Cancel then Save draft', async () => {
    open('/finance?tab=demand');
    expect(await screen.findByRole('heading', { level: 2, name: 'Demand statuses' })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('demand-new'));
    const dialog = await screen.findByRole('dialog', { name: 'New demand status draft' });
    expect(within(dialog).queryByText(/approves it before the economic view uses it/)).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'About this entry' })).toBeInTheDocument();
    expect(footerLabels(dialog)).toEqual(['Cancel', 'Save draft']);
  });

  it('exchange rate page: the Provisional label stays; its explanation is an ⓘ; Retire asks first', async () => {
    open('/finance/fx/f1');
    await screen.findByTestId('fx-detail');
    expect(screen.getByText('Provisional')).toBeInTheDocument();
    expect(screen.getByTestId('fx-provisional-note')).toBeInTheDocument();
    expect(screen.queryByText(/it converts only dates without an approved final rate/)).toBeNull();
    fireEvent.click(screen.getByTestId('fx-retire'));
    const confirm = await screen.findByRole('alertdialog', { name: 'Retire version 1?' });
    expect(within(confirm).getAllByRole('button').map((b) => b.textContent)).toEqual(['Cancel', 'Retire rate']);
  });
});
