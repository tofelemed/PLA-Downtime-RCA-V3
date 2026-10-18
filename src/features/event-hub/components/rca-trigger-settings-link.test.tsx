import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { actAs } from '@/test/acting-user';

vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock());
vi.mock('@/contexts/PlantSelectionContext', () => ({ usePlantSelection: () => ({ selection: null }) }));

const { RcaTriggerSettingsLink } = await import('./rca-trigger-settings-link');

describe('RCA trigger settings link (E-L2)', () => {
  afterEach(() => actAs('SuperAdmin'));

  it('is shown to a role that may edit the RCA trigger policy', () => {
    actAs('manager_approver');
    render(<MemoryRouter><RcaTriggerSettingsLink /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'RCA trigger settings' })).toHaveAttribute('href', '/events/rca-triggers');
  });

  it.each(['Operator', 'production_engineer', 'viewer'])('is hidden from %s', (role) => {
    actAs(role);
    render(<MemoryRouter><RcaTriggerSettingsLink /></MemoryRouter>);
    expect(screen.queryByTestId('rca-trigger-settings')).toBeNull();
  });
});
