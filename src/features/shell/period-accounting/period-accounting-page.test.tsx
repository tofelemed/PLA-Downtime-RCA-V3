import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const sonner = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('@/components/ui/sonner', () => sonner);
vi.mock('@/api/v2/queries/plans', () => ({
  usePlans: () => ({ data: { pages: [{ items: [], nextCursor: null }] }, hasNextPage: false, isError: false, error: null, refetch: vi.fn() }),
}));

const { PeriodAccountingPage } = await import('./period-accounting-page');

describe('/period-accounting redirect (QA P-14)', () => {
  it('sends the hint through the accessible Sonner toast and redirects to the plan list', async () => {
    render(
      <MemoryRouter initialEntries={['/period-accounting']}>
        <Routes>
          <Route path="/period-accounting" element={<PeriodAccountingPage />} />
          <Route path="*" element={<p>Plans</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('Plans')).toBeInTheDocument();
    expect(sonner.toast).toHaveBeenCalledWith('Period accounting', { description: expect.stringContaining('No plan has an approved version valid today') });
  });
});
