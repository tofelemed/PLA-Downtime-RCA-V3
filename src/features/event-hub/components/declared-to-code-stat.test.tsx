import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { defaultFilters } from '../model/event-filters';

const state = { pages: [{ items: [{ id: 'a' }, { id: 'b' }] }], hasNextPage: false };
vi.mock('@/api/v2/queries/production-events', () => ({
  useProductionEvents: () => ({ data: { pages: state.pages }, hasNextPage: state.hasNextPage, isLoading: false, isError: false }),
}));
vi.mock('@/api/v2/queries/use-v2-list', () => ({
  flattenPages: (pages: Array<{ items: unknown[] }> | undefined) => (pages ?? []).flatMap((page) => page.items),
}));
vi.mock('../use-event-hub-env', () => ({ useEventHubEnv: () => ({ timezone: 'UTC' }) }));
vi.mock('@/features/ux-kit/use-number-format', () => ({ useNumberFormat: () => ({ number: (value: number) => String(value) }) }));

const { DeclaredToCodeStat } = await import('./declared-to-code-stat');
const filters = defaultFilters({ from: '2026-10-01T00:00:00Z', to: '2026-10-31T00:00:00Z', label: 'October' });

describe('production loss to code tile', () => {
  it('shows the count only, with a plus when more pages exist, and no tonnes', () => {
    const { rerender } = render(<DeclaredToCodeStat filters={filters} />);
    expect(screen.getByTestId('quick-stats-production-loss').textContent).toBe('Production loss to code2');
    state.hasNextPage = true;
    rerender(<DeclaredToCodeStat filters={filters} />);
    expect(screen.getByTestId('quick-stats-production-loss').textContent).toBe('Production loss to code2+');
  });
});
