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
const plant = (id: string, organizationId: string): Tenant => ({ id, name: id, organizationId }) as Tenant;
// the demo world of docs/DEMO_PERSONAS.md
const DEMO = plant('plant-demo', 'org-demo');
const DEMO_2 = plant('plant-demo-2', 'org-demo');
const PARTNER = plant('plant-partner', 'org-partner');
const orgAdmin = (home: Tenant, scopes: SessionScope[]): AuthenticatedUser => ({
  ...user('OrgAdmin', home.id, scopes),
  organizationId: home.organizationId,
});

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

  it('lists every plant for SuperAdmin, the organisation for OrgAdmin and only the scoped plants for everyone else', () => {
    const tenants = [tenant('t1'), tenant('t2'), tenant('t3')];
    expect(selectableTenants(user('SuperAdmin'), tenants).map((t) => t.id)).toEqual(['t1', 't2', 't3']);
    // an OrgAdmin whose session carries no organisation: the organisation of its home plant (from the list)
    expect(selectableTenants(user('OrgAdmin', 't1'), tenants).map((t) => t.id)).toEqual(['t1', 't2', 't3']);
    const viewer = user('Operator', 't2', [{ tenantId: 't2', role: 'operator' }, { tenantId: 't1', role: 'viewer' }]);
    expect(selectableTenants(viewer, tenants).map((t) => t.id)).toEqual(['t1', 't2']);
    expect(selectableTenants(user('Engineer', 't3'), tenants).map((t) => t.id)).toEqual(['t3']);
  });

  it('an OrgAdmin of Partner Org sees only the Partner plants; a Demo Org OrgAdmin never sees Partner Plant', () => {
    const all = [DEMO, DEMO_2, PARTNER];
    const lucas = orgAdmin(PARTNER, [{ tenantId: PARTNER.id, organizationId: 'org-partner', role: 'OrgAdmin' }]);
    expect(selectableTenants(lucas, all).map((t) => t.id)).toEqual([PARTNER.id]);
    expect(defaultTenantFor(lucas, all)?.id).toBe(PARTNER.id);
    const isabel = orgAdmin(DEMO, [
      { tenantId: DEMO.id, organizationId: 'org-demo', role: 'OrgAdmin' },
      { tenantId: DEMO_2.id, organizationId: 'org-demo', role: 'OrgAdmin' },
    ]);
    expect(selectableTenants(isabel, all).map((t) => t.id)).toEqual([DEMO.id, DEMO_2.id]);
    expect(isSelectionAllowed({ tenant: PARTNER }, isabel)).toBe(false);
    expect(isSelectionAllowed({ tenant: PARTNER }, user('SuperAdmin'))).toBe(true);
  });

  it('a stored selection of a plant outside the OrgAdmin organisation is dropped (reset to the default plant)', () => {
    const isabel = orgAdmin(DEMO, [{ tenantId: DEMO.id, organizationId: 'org-demo', role: 'OrgAdmin' }]);
    window.localStorage.setItem(`proact.plantSelection.${isabel.id}`, JSON.stringify({ tenant: PARTNER }));
    expect(loadPlantSelection(isabel)).toBeNull();
    expect(defaultTenantFor(isabel, [PARTNER, DEMO_2, DEMO])?.id).toBe(DEMO.id);
    // a stored plant whose organisation is unknown is left to the server (the plant access guard shows the refusal)
    const unknownOrg = { id: PARTNER.id, name: PARTNER.name } as Tenant;
    window.localStorage.setItem(`proact.plantSelection.${isabel.id}`, JSON.stringify({ tenant: unknownOrg }));
    expect(loadPlantSelection(isabel)?.tenant?.id).toBe(PARTNER.id);
  });

  it('survives unreadable stored values', () => {
    const engineer = user('Engineer', 't1');
    window.localStorage.setItem(`proact.plantSelection.${engineer.id}`, '{not json');
    expect(loadPlantSelection(engineer)).toBeNull();
  });
});
