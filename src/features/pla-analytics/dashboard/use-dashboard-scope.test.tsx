import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reliabilityScope } from './reliability-model';
import { useDashboardScope } from './use-dashboard-scope';

type Selection = { organization?: { id: string }; tenant?: { id: string }; unit?: { id: string }; asset?: { id: string } } | null;
let selection: Selection = null;
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection }) }));

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={['/?window=6m']}>{children}</MemoryRouter>;

describe('useDashboardScope', () => {
  beforeEach(() => {
    selection = null;
  });
  afterEach(() => vi.useRealTimers());

  it('rolls the window forward on an open page, with the reliability trend ending at the same instant', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-24T12:00:30Z'));
    selection = { tenant: { id: 't1' } };
    const short = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={['/?window=7d']}>{children}</MemoryRouter>;
    const { result } = renderHook(() => useDashboardScope(), { wrapper: short });
    const first = result.current.scope.to;
    expect(first).toBe('2026-10-24T12:01:00.000Z');
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(Date.parse(result.current.scope.to)).toBeGreaterThan(Date.parse(first));
    expect(reliabilityScope(result.current.scope, result.current.node).scope.to).toBe(result.current.scope.to);
  });

  it('reads the period from the URL and the node from the selection as it moves asset to plant to unit', () => {
    const tenant = { id: 't1' };
    selection = { tenant, unit: { id: 'u1' }, asset: { id: 'a1' } };
    const { result, rerender } = renderHook(() => useDashboardScope(), { wrapper });
    expect(result.current.key).toBe('6m');
    expect(result.current.scope.trendBy).toBe('month');
    expect(result.current.node).toEqual({ unitId: 'u1', assetId: 'a1' });
    selection = { tenant };
    rerender();
    expect(result.current.node).toEqual({});
    expect(result.current.scope.unitIds).toEqual([]);
    selection = { tenant, unit: { id: 'u1' } };
    rerender();
    expect(result.current.node).toEqual({ unitId: 'u1' });
    expect(result.current.scope.unitIds).toEqual(['u1']);
  });

  it('is orgOnly when an organisation is chosen without a plant', () => {
    selection = { organization: { id: 'o1' } };
    expect(renderHook(() => useDashboardScope(), { wrapper }).result.current.orgOnly).toBe(true);
    selection = { organization: { id: 'o1' }, tenant: { id: 't1' } };
    expect(renderHook(() => useDashboardScope(), { wrapper }).result.current.orgOnly).toBe(false);
  });
});
