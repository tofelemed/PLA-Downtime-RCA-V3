import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDashboardScope } from './use-dashboard-scope';

type Selection = { organization?: { id: string }; tenant?: { id: string }; unit?: { id: string }; asset?: { id: string } } | null;
let selection: Selection = null;
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection }) }));

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={['/?window=6m']}>{children}</MemoryRouter>;

describe('useDashboardScope', () => {
  beforeEach(() => {
    selection = null;
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
