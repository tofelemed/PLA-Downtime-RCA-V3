import type { AuthenticatedUser } from '@/services/api/authApi';

/**
 * The signed-in user of a component test, switchable per test (`actAs('viewer')`). Mock the auth context
 * with `vi.mock('@/contexts/AuthContext', async () => (await import('@/test/acting-user')).authContextMock())`;
 * capabilities are then derived from the role exactly as in the app (home tenant `tenant-a`).
 */
export const TEST_TENANT = 'tenant-a';

const state: { user: AuthenticatedUser } = { user: userWith('SuperAdmin', 'user-1') };

function userWith(role: string, id: string): AuthenticatedUser {
  return { id, name: 'Test user', email: 'test@example.com', role, isActive: true, tenantId: TEST_TENANT, homeTenantId: TEST_TENANT, scopes: [] };
}

/** Act as a user holding `role` (legacy or scope role) in the home tenant. */
export function actAs(role: string, id = 'user-1'): void {
  state.user = userWith(role, id);
}

export function authContextMock() {
  return { useAuth: () => ({ session: { tenant: { id: TEST_TENANT }, user: state.user } }) };
}
