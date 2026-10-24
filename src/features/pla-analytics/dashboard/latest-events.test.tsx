import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { dashboardScope } from '../model/dashboard-scope';

const calls = vi.hoisted(() => [] as Array<Record<string, unknown>>);
vi.mock('@/api/v2/queries/production-events', () => ({
  useProductionEvents: (filters: Record<string, unknown>) => {
    calls.push(filters);
    return { data: { pages: [{ items: [] }] }, isLoading: false, isError: false, isSuccess: true, error: null, refetch: vi.fn() };
  },
}));
vi.mock('@/features/event-hub/use-event-hub-env', () => ({
  useEventHubEnv: () => ({ timezone: 'UTC', unitName: (id: string) => id, reasonName: (id: string) => id }),
}));

const { LatestEvents } = await import('./latest-events');

describe('Dashboard latest loss events', () => {
  it('asks the server for the newest five loss events of the unit in scope', () => {
    const scope = dashboardScope('7d', { unitId: 'u-7' }, Date.parse('2026-10-24T12:00:00Z'));
    render(
      <MemoryRouter>
        <LatestEvents scope={scope} />
      </MemoryRouter>,
    );
    expect(calls.at(-1)).toMatchObject({
      unitIds: ['u-7'],
      from: scope.from,
      to: scope.to,
      limit: 5,
      sort: '-startTime',
      physicalTypes: ['downtime', 'slowdown', 'quality_loss'],
      physicalStates: ['open', 'closed'],
    });
  });

  it('leaves the units open for the whole plant', () => {
    render(
      <MemoryRouter>
        <LatestEvents scope={dashboardScope('7d', {}, Date.parse('2026-10-24T12:00:00Z'))} />
      </MemoryRouter>,
    );
    expect(calls.at(-1)?.unitIds).toBeUndefined();
  });
});
