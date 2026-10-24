import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlantSelector } from './plant-selector';
import { PlantTree } from './plant-tree';

const directory = vi.hoisted(() => ({
  units: [] as Array<{ id: string; code: string; name: string }>,
  presence: new Map<string, boolean>(),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: null }) }));
vi.mock('@/contexts/PlantSelectionContext', () => ({
  usePlantSelection: () => ({ selection: null, setSelection: vi.fn(), loading: true }),
}));
vi.mock('./use-plant-directory', () => ({
  usePlantDirectory: () => ({ isLoading: true, organizations: [], tenants: [] }),
  usePlantUnits: () => ({ isLoading: false, isError: false, data: directory.units }),
  useUnitAssetPresence: () => directory.presence,
  useUnitAssets: () => ({ isLoading: false, isError: false, data: [] }),
}));

describe('plant selector loading state', () => {
  it('exposes its loading message through a named status role', () => {
    render(<PlantSelector />);
    expect(screen.getByRole('status', { name: 'Loading plants' })).toBeVisible();
  });
});

describe('plant tree chevrons', () => {
  const organization = { id: 'org-1', code: 'O', name: 'Org' };
  const tenant = { id: 'plant-a', code: 'A', name: 'Plant A', organizationId: 'org-1' };
  const renderTree = () =>
    render(<PlantTree organizations={[organization]} tenants={[tenant]} selection={{ organization, tenant }} onSelect={vi.fn()} />);

  beforeEach(() => {
    directory.units = [];
    directory.presence = new Map();
  });

  it('unit without assets has no expand button', () => {
    directory.units = [{ id: 'u1', code: 'K1', name: 'Kiln 1' }, { id: 'u2', code: 'K2', name: 'Kiln 2' }];
    directory.presence = new Map([['u1', false], ['u2', true]]);
    renderTree();
    expect(screen.queryByRole('button', { name: /expand kiln 1/i })).toBeNull();
    expect(screen.getByRole('button', { name: /expand kiln 2/i })).toBeVisible();
  });

  it('unit stays expandable until its presence arrives', () => {
    directory.units = [{ id: 'u1', code: 'K1', name: 'Kiln 1' }];
    renderTree();
    expect(screen.getByRole('button', { name: /expand kiln 1/i })).toBeVisible();
  });

  it('plant whose unit list is empty loses its chevron', () => {
    renderTree();
    expect(screen.queryByRole('button', { name: /(expand|collapse) plant a/i })).toBeNull();
  });
});
