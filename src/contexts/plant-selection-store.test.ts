import { beforeEach, describe, expect, it } from 'vitest';
import type { AuthenticatedUser, SessionScope } from '../services/api/authApi';
import type { Tenant } from '../services/MasterDataService';
import {
  defaultTenantFor,
  isSelectionAllowed,
  loadPlantSelection,
  savePlantSelection,
  selectableTenants,
} from './plant-selection-store';

const user = (role: string, tenantId?: string, scopes?: SessionScope[]): AuthenticatedUser => ({
  id: `u-${role}-${tenantId ?? 'none'}`,
  name: 'u',
  email: 'u@test.local',
  role,
  isActive: true,
  tenantId,
  ...(scopes ? { homeTenantId: tenantId ?? null, scopes } : {}),
});
const tenant = (id: string): Tenant => ({ id, name: id, organizationId: 'org' }) as Tenant;

describe('plant selection store', () => {
  beforeEach(() => window.localStorage.clear());

  it('keeps one selection per user', () => {
    const a = user('Engineer', 't1');
    const b = user('Engineer', 't2');
    savePlantSelection(a, { tenant: tenant('t1') });
    expect(loadPlantSelection(a)?.tenant?.id).toBe('t1');
    expect(loadPlantSelection(b)).toBeNull();
  });

  it('ignores a saved plant of another tenant for tenant-bound users', () => {
    const engineer = user('Engineer', 't2');
    window.localStorage.setItem(`proact.plantSelection.${engineer.id}`, JSON.stringify({ tenant: tenant('t1') }));
    expect(loadPlantSelection(engineer)).toBeNull();
    expect(isSelectionAllowed({ tenant: tenant('t1') }, user('SuperAdmin'))).toBe(true);
  });

  it('allows every tenant the user holds a scope in, not only the home tenant', () => {
    const viewer = user('Operator', 't2', [{ tenantId: 't2', role: 'operator' }, { tenantId: 't1', role: 'viewer' }]);
    expect(isSelectionAllowed({ tenant: tenant('t1') }, viewer)).toBe(true);
    expect(isSelectionAllowed({ tenant: tenant('t2') }, viewer)).toBe(true);
    expect(isSelectionAllowed({ tenant: tenant('t3') }, viewer)).toBe(false);
    savePlantSelection(viewer, { tenant: tenant('t1') });
    expect(loadPlantSelection(viewer)?.tenant?.id).toBe('t1');
  });

  it('defaults to the user own tenant; only global admins fall back to the first plant', () => {
    const tenants = [tenant('t1'), tenant('t2')];
    expect(defaultTenantFor(user('Engineer', 't2'), tenants)?.id).toBe('t2');
    expect(defaultTenantFor(user('Engineer', 't9'), tenants)).toBeNull();
    expect(defaultTenantFor(user('SuperAdmin'), tenants)?.id).toBe('t1');
  });

  it('a user whose home plant is not listed defaults to the first scoped plant', () => {
    const tenants = [tenant('t1'), tenant('t2')];
    const scoped = user('Operator', 't9', [{ tenantId: 't9', role: 'operator' }, { tenantId: 't2', role: 'viewer' }]);
    expect(defaultTenantFor(scoped, tenants)?.id).toBe('t2');
  });

  it('lists every plant for global admins and only the scoped plants for everyone else', () => {
    const tenants = [tenant('t1'), tenant('t2'), tenant('t3')];
    expect(selectableTenants(user('OrgAdmin', 't1'), tenants).map((t) => t.id)).toEqual(['t1', 't2', 't3']);
    const viewer = user('Operator', 't2', [{ tenantId: 't2', role: 'operator' }, { tenantId: 't1', role: 'viewer' }]);
    expect(selectableTenants(viewer, tenants).map((t) => t.id)).toEqual(['t1', 't2']);
    expect(selectableTenants(user('Engineer', 't3'), tenants).map((t) => t.id)).toEqual(['t3']);
  });

  it('survives unreadable stored values', () => {
    const engineer = user('Engineer', 't1');
    window.localStorage.setItem(`proact.plantSelection.${engineer.id}`, '{not json');
    expect(loadPlantSelection(engineer)).toBeNull();
  });
});
