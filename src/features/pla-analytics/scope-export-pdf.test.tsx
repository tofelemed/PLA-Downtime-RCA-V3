import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { DisplayCurrencyContext } from '@/features/display-currency/display-currency-context';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: { tenant: { id: 'tenant-a' } } }) }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { ScopeExport } = await import('./components/scope-export');

const REQUEST = { reportType: 'period_summary', format: 'csv', revisionSelector: 'published', from: '2026-10-01T00:00:00.000Z', to: '2026-10-08T00:00:00.000Z' } as const;

function wrap(children: ReactNode, currency: 'USD' | 'IRR') {
  const client = new QueryClient();
  return (
    <QueryClientProvider client={client}>
      <DisplayCurrencyContext.Provider value={{ currency, setCurrency: () => undefined }}>{children}</DisplayCurrencyContext.Provider>
    </QueryClientProvider>
  );
}

describe('PDF export of the shown scope', () => {
  it('asks the server for a PDF in the display currency; CSV stays as it was', () => {
    render(wrap(<ScopeExport request={{ ...REQUEST }} label="Period summary" timezone="UTC" format="pdf" testId="pdf" />, 'IRR'));
    expect(JSON.parse(screen.getByTestId('pdf').getAttribute('data-request') ?? '{}')).toMatchObject({ format: 'pdf', currency: 'IRR' });
    expect(screen.getByTestId('pdf-start')).toHaveTextContent('Period summary (PDF)');
  });

  it('CSV requests carry no currency', () => {
    render(wrap(<ScopeExport request={{ ...REQUEST }} label="Loss lines" timezone="UTC" testId="csv" />, 'USD'));
    const request = JSON.parse(screen.getByTestId('csv').getAttribute('data-request') ?? '{}') as Record<string, unknown>;
    expect(request.format).toBe('csv');
    expect(request).not.toHaveProperty('currency');
  });
});
