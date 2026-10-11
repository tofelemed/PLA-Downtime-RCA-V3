import { describe, expect, it } from 'vitest';
import type { FeatureFlagKey } from '@/api/v2/types/flags';
import { capabilitiesOf } from './capabilities';
import { effectiveRoles, type RoleSubject } from './effective-roles';
import { NAVIGATION_ITEMS, visibleNavigationItems } from './navigation-items';

/**
 * The menu as Navigation.tsx listed it before capabilities (one legacy-role list per item). Every
 * legacy demo user must keep exactly this menu in its home plant.
 */
const ALL = ['SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'Manager', 'Analyst', 'Engineer', 'Operator'];
const NOT_OPERATOR = ['SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'Manager', 'Analyst', 'Engineer'];
const ADMINS = ['SuperAdmin', 'OrgAdmin', 'TenantAdmin'];
const PREVIOUS_MENU: Record<string, string[]> = {
  Dashboard: ALL,
  Reports: NOT_OPERATOR,
  'Production Loss Analysis': ALL,
  'Production Plans': NOT_OPERATOR,
  'Plans, Profiles & Calendars': NOT_OPERATOR,
  'Event Hub': ALL,
  'Downtime Analysis': ALL,
  'RCA Analysis': NOT_OPERATOR,
  'Knowledge Base': NOT_OPERATOR,
  'Master Data': ADMINS,
  'Codes & Rules': NOT_OPERATOR,
  Finance: NOT_OPERATOR,
  'User Management': ADMINS,
  'Admin Panel': ['SuperAdmin'],
  Permissions: ADMINS,
  Connectivity: ADMINS,
  'Enhanced Historian': NOT_OPERATOR,
  Tasks: ALL,
  'Audit Logs': ['SuperAdmin', 'OrgAdmin'],
  Settings: ADMINS,
  'Data Seeding': ADMINS,
};

const FLAGS_ON: Partial<Record<FeatureFlagKey, boolean>> = {
  'v2.downtimeAnalysis': true,
  'v2.plansProfilesCalendars': true,
  'v2.codesAdmin': true,
};

const HOME = 'plant-demo';
const legacyUser = (role: string): RoleSubject => ({ role, tenantId: HOME, homeTenantId: HOME, organizationId: 'org-demo', scopes: [] });

const menuFor = (user: RoleSubject, tenantId: string | null = HOME) =>
  visibleNavigationItems(capabilitiesOf(effectiveRoles(user, { tenantId })), FLAGS_ON).map((item) => item.name);

describe('navigation items by capability', () => {
  it('every item is still listed, in the same order', () => {
    expect(NAVIGATION_ITEMS.map((item) => item.name)).toEqual(Object.keys(PREVIOUS_MENU));
  });

  it.each(ALL)('a legacy %s user in its home plant sees the same menu as before', (role) => {
    const expected = Object.entries(PREVIOUS_MENU).filter(([, roles]) => roles.includes(role)).map(([name]) => name);
    expect(menuFor(legacyUser(role))).toEqual(expected);
  });

  it('the same menu with a session stored before the server sent scopes', () => {
    const manager: RoleSubject = { role: 'Manager', tenantId: HOME };
    expect(menuFor(manager)).toEqual(menuFor(legacyUser('Manager')));
    expect(menuFor(manager, null)).toEqual(menuFor(legacyUser('Manager')));
  });

  it('flags hide their screens', () => {
    const names = visibleNavigationItems(capabilitiesOf(['SuperAdmin']), {}).map((item) => item.name);
    expect(names).not.toContain('Downtime Analysis');
    expect(names).not.toContain('Plans, Profiles & Calendars');
    expect(names).not.toContain('Codes & Rules');
    expect(names).not.toContain('Finance');
    expect(names).toContain('Dashboard');
  });

  it('a master_data_admin (legacy Analyst) gains Master Data and nothing else', () => {
    const charlotte: RoleSubject = { ...legacyUser('Analyst'), scopes: [{ tenantId: HOME, role: 'production_engineer' }, { tenantId: HOME, role: 'master_data_admin' }] };
    expect(menuFor(charlotte)).toEqual([...menuFor(legacyUser('Analyst')), 'Master Data'].sort(byMenuOrder));
  });

  it('an integration_admin (legacy Engineer) gains Connectivity and nothing else', () => {
    const elena: RoleSubject = { ...legacyUser('Engineer'), scopes: [{ tenantId: HOME, role: 'production_engineer' }, { tenantId: HOME, role: 'integration_admin' }] };
    expect(menuFor(elena)).toEqual([...menuFor(legacyUser('Engineer')), 'Connectivity'].sort(byMenuOrder));
  });

  it('a viewer in another plant sees the read screens only', () => {
    const grace: RoleSubject = {
      role: 'Operator',
      tenantId: 'plant-demo-2',
      homeTenantId: 'plant-demo-2',
      organizationId: 'org-demo',
      scopes: [{ tenantId: 'plant-demo-2', role: 'operator' }, { tenantId: HOME, role: 'viewer' }],
    };
    expect(menuFor(grace, HOME)).toEqual(menuFor(legacyUser('Engineer')));
    expect(menuFor(grace, 'plant-demo-2')).toEqual(menuFor(legacyUser('Operator')));
    expect(menuFor(grace, 'plant-partner')).toEqual([]);
  });
});

const order = new Map(NAVIGATION_ITEMS.map((item, index) => [item.name, index]));
function byMenuOrder(a: string, b: string): number {
  return (order.get(a) ?? 0) - (order.get(b) ?? 0);
}
