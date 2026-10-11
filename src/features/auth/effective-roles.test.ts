import { describe, expect, it } from 'vitest';
import type { SessionScope } from '@/services/api/authApi';
import {
  effectiveRoles,
  legacyRoleAppliesIn,
  maySelectTenant,
  rolesForLegacyRole,
  scopedTenantIds,
  type RoleSubject,
} from './effective-roles';

// the demo world of docs/DEMO_PERSONAS.md: Demo Org (Demo Plant, Demo Plant 2) and Partner Org (Partner Plant)
const DEMO_ORG = 'org-demo';
const PARTNER_ORG = 'org-partner';
const DEMO = 'plant-demo';
const DEMO_2 = 'plant-demo-2';
const PARTNER = 'plant-partner';

const scope = (tenantId: string, role: string, organizationId = DEMO_ORG): SessionScope => ({ tenantId, organizationId, role });

const user = (role: string, homeTenantId: string, scopes: SessionScope[] = [], organizationId = DEMO_ORG): RoleSubject => ({
  role,
  tenantId: homeTenantId,
  organizationId,
  homeTenantId,
  scopes,
});

const at = (tenantId: string | null, organizationId: string | null = DEMO_ORG) => ({ tenantId, organizationId });

describe('rolesForLegacyRole (D06 mapping, mirrors role-model.ts)', () => {
  it('carries the legacy role and its scope role once', () => {
    expect(rolesForLegacyRole('TenantAdmin')).toEqual(['TenantAdmin', 'manager_approver']);
    expect(rolesForLegacyRole('Manager')).toEqual(['Manager', 'manager_approver']);
    expect(rolesForLegacyRole('Analyst')).toEqual(['Analyst', 'production_engineer']);
    expect(rolesForLegacyRole('Engineer')).toEqual(['Engineer', 'production_engineer']);
    expect(rolesForLegacyRole('Operator')).toEqual(['Operator', 'operator']);
    expect(rolesForLegacyRole('SuperAdmin')).toEqual(['SuperAdmin']);
    expect(rolesForLegacyRole('OrgAdmin')).toEqual(['OrgAdmin']);
    expect(rolesForLegacyRole('viewer')).toEqual(['viewer']);
    expect(rolesForLegacyRole(null)).toEqual([]);
  });
});

describe('effectiveRoles (mirrors RequestContextFactory.build)', () => {
  it('home tenant: legacy role, its mapping and the scope roles held there', () => {
    const engineer = user('Engineer', DEMO, [scope(DEMO, 'production_engineer'), scope(DEMO, 'reliability_engineer')]);
    expect(effectiveRoles(engineer, at(DEMO))).toEqual(['Engineer', 'production_engineer', 'reliability_engineer']);
  });

  it('no selection means the home tenant', () => {
    const analyst = user('Analyst', DEMO, [scope(DEMO, 'master_data_admin')]);
    expect(effectiveRoles(analyst, at(null))).toEqual(['Analyst', 'production_engineer', 'master_data_admin']);
    expect(effectiveRoles(analyst, { tenantId: undefined })).toEqual(['Analyst', 'production_engineer', 'master_data_admin']);
  });

  it('another tenant: only the scope roles held there, never the home roles', () => {
    const viewer = user('Operator', DEMO_2, [scope(DEMO_2, 'operator'), scope(DEMO, 'viewer')]);
    expect(effectiveRoles(viewer, at(DEMO))).toEqual(['viewer']);
    expect(effectiveRoles(viewer, at(DEMO_2))).toEqual(['Operator', 'operator']);
    expect(effectiveRoles(viewer, at(PARTNER, PARTNER_ORG))).toEqual([]);
  });

  it('SuperAdmin keeps its role in every tenant', () => {
    const admin = user('SuperAdmin', DEMO, [scope(DEMO, 'SuperAdmin')]);
    expect(effectiveRoles(admin, at(PARTNER, PARTNER_ORG))).toEqual(['SuperAdmin']);
    expect(effectiveRoles({ ...admin, tenantId: undefined, homeTenantId: null }, at(DEMO_2))).toEqual(['SuperAdmin']);
  });

  it('OrgAdmin keeps its role inside its organization only', () => {
    const orgAdmin = user('OrgAdmin', DEMO, [scope(DEMO, 'OrgAdmin'), scope(DEMO_2, 'OrgAdmin')]);
    expect(effectiveRoles(orgAdmin, at(DEMO_2))).toEqual(['OrgAdmin']);
    expect(effectiveRoles(orgAdmin, at(PARTNER, PARTNER_ORG))).toEqual([]);
    expect(legacyRoleAppliesIn(orgAdmin, at(PARTNER, PARTNER_ORG))).toBe(false);
  });

  it('OrgAdmin: an unknown organization of the acting plant falls back to the scope, then to the server', () => {
    const orgAdmin = user('OrgAdmin', DEMO, [scope(DEMO_2, 'OrgAdmin', DEMO_ORG), scope(PARTNER, 'viewer', PARTNER_ORG)]);
    expect(effectiveRoles(orgAdmin, at(DEMO_2, null))).toEqual(['OrgAdmin']);
    expect(effectiveRoles(orgAdmin, at(PARTNER, null))).toEqual(['viewer']);
    expect(legacyRoleAppliesIn(orgAdmin, { tenantId: 'plant-unknown' })).toBe(true);
  });

  it('a session stored before the server sent scopes behaves like the legacy role in the home tenant', () => {
    const legacy: RoleSubject = { role: 'TenantAdmin', tenantId: DEMO, organizationId: DEMO_ORG };
    expect(effectiveRoles(legacy, at(null))).toEqual(['TenantAdmin', 'manager_approver']);
    expect(effectiveRoles(legacy, at(DEMO))).toEqual(['TenantAdmin', 'manager_approver']);
    expect(effectiveRoles(legacy, at(DEMO_2))).toEqual([]);
  });

  it('integration_admin and master_data_admin scopes add to the legacy role', () => {
    const diego = user('Analyst', DEMO, [scope(DEMO, 'production_engineer'), scope(DEMO, 'integration_admin'), scope(DEMO_2, 'integration_admin')]);
    expect(effectiveRoles(diego, at(DEMO))).toEqual(['Analyst', 'production_engineer', 'integration_admin']);
    expect(effectiveRoles(diego, at(DEMO_2))).toEqual(['integration_admin']);
  });
});

describe('maySelectTenant / scopedTenantIds (mirrors maySelectTenant)', () => {
  it('lists the home tenant and every scoped tenant once', () => {
    const viewer = user('Operator', DEMO_2, [scope(DEMO_2, 'operator'), scope(DEMO, 'viewer'), scope(DEMO, 'operator')]);
    expect(scopedTenantIds(viewer)).toEqual([DEMO_2, DEMO]);
    expect(maySelectTenant(viewer, DEMO)).toBe(true);
    expect(maySelectTenant(viewer, DEMO_2)).toBe(true);
    expect(maySelectTenant(viewer, PARTNER)).toBe(false);
  });

  it('global admins may pick any plant in the UI; the server verifies', () => {
    expect(maySelectTenant(user('SuperAdmin', DEMO), PARTNER)).toBe(true);
    expect(maySelectTenant(user('OrgAdmin', DEMO), DEMO_2)).toBe(true);
  });

  it('a user without scopes (older session) may only pick the home tenant', () => {
    const engineer: RoleSubject = { role: 'Engineer', tenantId: DEMO };
    expect(scopedTenantIds(engineer)).toEqual([DEMO]);
    expect(maySelectTenant(engineer, DEMO)).toBe(true);
    expect(maySelectTenant(engineer, DEMO_2)).toBe(false);
    expect(scopedTenantIds({ role: 'Engineer' })).toEqual([]);
  });
});
