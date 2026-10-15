import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PlantSelectionProvider, usePlantSelection } from './PlantSelectionContext';
import type { AuthenticatedUser } from '@/services/api/authApi';

const auth = vi.hoisted(() => ({ session: null as { user: AuthenticatedUser } | null, isLoading: false }));
vi.mock('./AuthContext', () => ({ useAuth: () => auth }));
const alice: AuthenticatedUser = { id: 'alice', name: 'Alice', email: 'alice@example.test', role: 'viewer', isActive: true, tenantId: 'plant-a' };
const seen: Array<{ user: string | undefined; tenant: string | undefined }> = [];
function Probe() {
  const { selection, setSelection } = usePlantSelection();
  seen.push({ user: auth.session?.user.id, tenant: selection?.tenant?.id });
  return <button onClick={() => setSelection({ tenant: { id: 'plant-a', name: 'A', code: 'A', organizationId: 'org-a' } })}>Select A</button>;
}
describe('plant selection ownership', () => {
  beforeEach(() => { localStorage.clear(); seen.length = 0; auth.session = { user: alice }; });
  it('never exposes an old user selection during a new user render or sign-out', () => {
    const view = render(<PlantSelectionProvider><Probe /></PlantSelectionProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Select A' }));
    expect(seen.at(-1)?.tenant).toBe('plant-a');
    auth.session = { user: { ...alice, id: 'bob', tenantId: 'plant-b' } };
    view.rerender(<PlantSelectionProvider><Probe /></PlantSelectionProvider>);
    expect(seen.filter((value) => value.user === 'bob').every((value) => value.tenant === undefined)).toBe(true);
    auth.session = null; view.rerender(<PlantSelectionProvider><Probe /></PlantSelectionProvider>);
    expect(seen.at(-1)?.tenant).toBeUndefined();
  });
});
