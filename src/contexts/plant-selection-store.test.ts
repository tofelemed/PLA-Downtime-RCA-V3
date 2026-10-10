import { beforeEach, describe, expect, it } from 'vitest';
import type { AuthenticatedUser } from '../services/api/authApi';
import type { Tenant } from '../services/MasterDataService';
import {
  defaultTenantFor,
  isSelectionAllowed,
  loadPlantSelection,
  savePlantSelection,
} from './plant-selection-store';

const user = (role: string, tenantId?: string): AuthenticatedUser => ({
  id: `u-${role}-${tenantId ?? 'none'}`,
  name: 'u',
  email: 'u@test.local',
  role,
  isActive: true,
  tenantId,
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

  it('defaults to the user own tenant; only global admins fall back to the first plant', () => {
    const tenants = [tenant('t1'), tenant('t2')];
    expect(defaultTenantFor(user('Engineer', 't2'), tenants)?.id).toBe('t2');
    expect(defaultTenantFor(user('Engineer', 't9'), tenants)).toBeNull();
    expect(defaultTenantFor(user('SuperAdmin'), tenants)?.id).toBe('t1');
  });

  it('survives unreadable stored values', () => {
    const engineer = user('Engineer', 't1');
    window.localStorage.setItem(`proact.plantSelection.${engineer.id}`, '{not json');
    expect(loadPlantSelection(engineer)).toBeNull();
  });
});
