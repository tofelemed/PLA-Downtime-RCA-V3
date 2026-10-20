import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ProductionRowView } from '@/api/v2/types/ops-reports';

const row: ProductionRowView = {
  key: 'total',
  productId: 'p1',
  productCode: 'HD5218',
  productName: 'Film',
  uom: 't',
  capacity: '3000',
  target: '3000',
  actual: '2550',
  gross: '2600',
  good: '2550',
  prime: '2500',
  wideSpec: '50',
  downgrade: '30',
  transitionOffGrade: '20',
  scrap: '0',
  rework: '0',
  unclassified: null,
  recovered: '0',
  offGrade: '50',
  primeYield: '0.96153846',
  planAttainment: '0.85',
  slices: 3,
  completeSlices: 2,
};

const response = {
  data: { groupBy: 'total', rows: [row], calculationRunIds: ['r1'] },
  isProvisional: false,
  coverage: { from: '', to: '', ratio: 1 },
};

vi.mock('@/features/event-hub/use-event-hub-env', () => ({ useEventHubEnv: () => ({ timezone: 'UTC' }) }));
vi.mock('@/api/v2/queries/ops-reports', () => ({
  useProductionByProduct: () => ({ data: response, isLoading: false, isError: false, error: null, refetch: () => undefined }),
}));

const { ProductionTable } = await import('./production-table');

const SCOPE = { unitIds: ['u1'], from: '2026-10-17T02:30:00.000Z', to: '2026-10-18T02:30:00.000Z', approvedOnly: true } as Parameters<typeof ProductionTable>[0]['scope'];

describe('ProductionTable (R1)', () => {
  it('shows the server figures per product and says when actuals are incomplete', () => {
    render(<ProductionTable scope={SCOPE} title="Chosen days" testId="t" />);
    expect(screen.getByTestId('production-row')).toHaveTextContent('HD5218 · Film');
    expect(screen.getByText('85.0 %')).toBeInTheDocument();
    expect(screen.getByText(/Actuals are incomplete for one product/)).toBeInTheDocument();
  });
});
