import { cloneElement, type ReactElement } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlantView } from '@/api/v2/types/administration';
import { SeriesChart } from '@/features/pla-analytics/charts/series-chart';
import { DataTable } from '@/features/ux-kit/data-table';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import { ListPager } from '@/features/ux-kit/data-table/data-table-pager';
import type { PagerModel } from '@/features/ux-kit/data-table/pager-model';
import { Quantity } from '@/features/ux-kit/quantity';
import { CalendarPreferenceProvider } from './calendar-preference-provider';
import { applyPlantSettings, tenantKey } from './use-tenant-display-settings';

const auth = vi.hoisted(() => ({ session: { user: { id: 'u1' }, tenant: { id: 'tenant-a', name: 'Plant A' } } }));
const server = vi.hoisted(() => ({ plant: null as unknown }));
const typed = vi.hoisted(() => ({ values: [] as Array<string | null> }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/api/v2/queries/administration-shared', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  adminCall: vi.fn(async () => server.plant),
}));
// jsdom has no layout: give the chart a fixed size so Recharts draws its axis ticks
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return { ...actual, ResponsiveContainer: ({ children }: { children: ReactElement }) => cloneElement(children, { width: 600, height: 300 }) };
});

const plant = (digits: string): PlantView => ({
  id: 'tenant-a',
  code: 'A',
  name: 'Plant A',
  description: null,
  organizationId: 'org',
  organizationName: null,
  timezone: 'Asia/Tehran',
  calendarSystem: 'gregorian',
  digits,
  weekStart: 'saturday',
  isActive: true,
  canDelete: false,
  canEdit: false,
  rowVersion: 1,
});

const pager: PagerModel = {
  mode: 'pages',
  pageIndex: 1,
  pageSize: 20,
  pageSizeOptions: [20, 50],
  rangeStart: 21,
  rangeEnd: 40,
  totalCount: 1234,
  pageCount: 62,
  canPrevious: true,
  canNext: true,
  isFetchingPage: false,
  first: () => undefined,
  previous: () => undefined,
  next: () => undefined,
  setPageSize: () => undefined,
};

function Screen() {
  return (
    <CalendarPreferenceProvider>
      <span data-testid="quantity">
        <Quantity value="12345.678" uom="t" />
      </span>
      <div data-testid="chart">
        <SeriesChart rows={[{ label: 'W1', values: { a: '1500' } }, { label: 'W2', values: { a: '2500' } }]} series={[{ key: 'a', label: 'A' }]} kind="bar" />
      </div>
      <ListPager pager={pager} />
      <DataTable caption="Counts" columns={[{ id: 'n', header: 'Stops', cell: (row: { n: number }) => row.n }]} rows={[{ n: 4321 }]} getRowKey={(row) => String(row.n)} pager="none" />
      <DecimalInput value="1234.5" onChange={(value) => typed.values.push(value)} aria-label="Quantity" />
    </CalendarPreferenceProvider>
  );
}

const tickTexts = () => Array.from(screen.getByTestId('chart').querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick-value')).map((tick) => tick.textContent ?? '');

describe('the digits setting applies to every displayed number', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    server.plant = plant('latin');
    client.setQueryData(tenantKey('tenant-a'), server.plant);
    typed.values = [];
  });

  it('re-renders quantities, chart ticks, table counts and pager counts in Persian digits; inputs stay Latin', async () => {
    render(
      <QueryClientProvider client={client}>
        <Screen />
      </QueryClientProvider>,
    );
    expect(screen.getByTestId('quantity')).toHaveTextContent('12,345.68 t');
    expect(tickTexts()).toContain('1,300');
    expect(screen.getByText('21–40 of 1,234')).toBeInTheDocument();
    expect(screen.getByText('4,321')).toBeInTheDocument();

    server.plant = plant('persian');
    await act(() => applyPlantSettings(client, 'tenant-a', server.plant as PlantView));

    await waitFor(() => expect(screen.getByTestId('quantity')).toHaveTextContent('۱۲٬۳۴۵٫۶۸ t'));
    expect(tickTexts()).toContain('۱٬۳۰۰');
    expect(screen.getByText('۲۱–۴۰ of ۱٬۲۳۴')).toBeInTheDocument();
    expect(screen.getByText('Page ۲ of ۶۲')).toBeInTheDocument();
    expect(screen.getByText('۴٬۳۲۱')).toBeInTheDocument();

    const input = screen.getByLabelText('Quantity');
    expect(input).toHaveValue('1234.5');
    fireEvent.change(input, { target: { value: '۱۲٫۵' } });
    expect(typed.values).toEqual(['12.5']);
  });
});
