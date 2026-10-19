import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { v2Keys } from '@/api/v2/queries/query-keys';
import type { PlantView } from '@/api/v2/types/administration';
import { DurationText } from '@/features/ux-kit/duration-text';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { CalendarPreferenceProvider } from './calendar-preference-provider';
import { applyPlantSettings, tenantKey } from './use-tenant-display-settings';

const auth = vi.hoisted(() => ({ session: { user: { id: 'u1' }, tenant: { id: 'tenant-a', name: 'Plant A' } } }));
const server = vi.hoisted(() => ({ plant: null as unknown }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));
vi.mock('@/api/v2/queries/administration-shared', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  adminCall: vi.fn(async () => server.plant),
}));

const plant = (calendarSystem: string, digits: string): PlantView => ({
  id: 'tenant-a',
  code: 'A',
  name: 'Plant A',
  description: null,
  organizationId: 'org',
  organizationName: null,
  timezone: 'Asia/Tehran',
  calendarSystem,
  digits,
  weekStart: 'saturday',
  isActive: true,
  canDelete: false,
  canEdit: false,
  rowVersion: 1,
});

function Screen() {
  return (
    <CalendarPreferenceProvider>
      <span data-testid="time">
        <PlantTime iso="2026-10-12T06:30:00.000Z" tz="Asia/Tehran" withDate />
      </span>
      <span data-testid="duration">
        <DurationText seconds={5400} />
      </span>
    </CalendarPreferenceProvider>
  );
}

describe('plant settings apply on every screen at once', () => {
  let client: QueryClient;
  const reportsKey = v2Keys.list('tenant-a', 'reports', { filters: { kind: 'downtime' } });

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    server.plant = plant('gregorian', 'latin');
    client.setQueryData(tenantKey('tenant-a'), server.plant);
    client.setQueryData(reportsKey, { data: 'week buckets of the old week start' });
  });

  it('re-renders dates and durations in the new calendar and digits and refetches server-made figures', async () => {
    render(
      <QueryClientProvider client={client}>
        <Screen />
      </QueryClientProvider>,
    );
    expect(screen.getByTestId('time')).toHaveTextContent('2026-10-12 10:00 (+03:30 Asia/Tehran)');
    expect(screen.getByTestId('duration')).toHaveTextContent('1 h 30 min');

    server.plant = plant('persian', 'persian');
    await act(() => applyPlantSettings(client, 'tenant-a', server.plant as PlantView));

    await waitFor(() => expect(screen.getByTestId('time')).toHaveTextContent('۱۴۰۵/۰۷/۲۰ ۱۰:۰۰'));
    expect(screen.getByTestId('duration')).toHaveTextContent('۱ h ۳۰ min');
    expect(client.getQueryState(reportsKey)?.isInvalidated).toBe(true);
  });
});
