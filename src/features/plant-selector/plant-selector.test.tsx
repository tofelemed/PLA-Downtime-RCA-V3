import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlantSelector } from './plant-selector';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: null }) }));
vi.mock('@/contexts/PlantSelectionContext', () => ({
  usePlantSelection: () => ({ selection: null, setSelection: vi.fn(), loading: true }),
}));
vi.mock('./use-plant-directory', () => ({
  usePlantDirectory: () => ({ isLoading: true, organizations: [], tenants: [] }),
}));

describe('plant selector loading state', () => {
  it('exposes its loading message through a named status role', () => {
    render(<PlantSelector />);
    expect(screen.getByRole('status', { name: 'Loading plants' })).toBeVisible();
  });
});
