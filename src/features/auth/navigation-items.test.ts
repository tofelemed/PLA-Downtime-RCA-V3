import { describe, expect, it } from 'vitest';
import type { FeatureFlagKey } from '@/api/v2/types/flags';
import { capabilitiesOf } from './capabilities';
import { effectiveRoles, type RoleSubject } from './effective-roles';
import { groupNavigationItems, isNavItemActive, NAV_SECTIONS, NAVIGATION_ITEMS, visibleNavigationItems } from './navigation-items';

/**
 * The menu of each legacy demo user in its home plant (one legacy-role list per item): the menu
 * Navigation.tsx listed before capabilities, except where an item now follows its page gate or the
 * server's read roles (Admin Panel, Enhanced Historian, Audit Logs; APPLICATION_LOGIC_GUIDE §23).
 */
const ALL = ['SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'Manager', 'Analyst', 'Engineer', 'Operator'];
const NOT_OPERATOR = ['SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'Manager', 'Analyst', 'Engineer'];
const ADMINS = ['SuperAdmin', 'OrgAdmin', 'TenantAdmin'];
const PREVIOUS_MENU: Record<string, string[]> = {
  // Overview
  Dashboard: ALL,
  Reports: NOT_OPERATOR,
  // Production
  'Event Hub': ALL,
  'Downtime Analysis': ALL,
  'Production Loss Analysis': ALL,
  'Plans, Profiles & Calendars': NOT_OPERATOR,
  // EXPERT_REVIEW Area 3: my reconciliation queue (period writers, R-C) and month close (analysis roles, R-B)
  'My Queue': NOT_OPERATOR,
  'Month Close': NOT_OPERATOR,
  // SME E4 uncertainty budgets: read by every analysis role
  'Measurement Uncertainty': NOT_OPERATOR,
  // Reliability
  'RCA Analysis': NOT_OPERATOR,
  'Bad Actors': NOT_OPERATOR,
  'Knowledge Base': NOT_OPERATOR,
  Tasks: ALL,
  // Integration
  Connectivity: ADMINS,
  // SME R13 source status rules: read by every analysis role, written by integration admins / production accounting
  'Source Status Rules': NOT_OPERATOR,
  'Source Priority': NOT_OPERATOR,
  'Enhanced Historian': NOT_OPERATOR,
  // Administration: Master Data also for the writers of its reliability pages (Manager = manager_approver:
  // stop and plan policy; Operator = operator: standby log); they see only those pages' links
  'Master Data': [...ADMINS, 'Manager', 'Operator'],
  'Codes & Rules': NOT_OPERATOR,
  Finance: NOT_OPERATOR,
  'User Management': ADMINS,
  Permissions: ADMINS,
  'Admin Panel': ['SuperAdmin', 'TenantAdmin'],
  'Audit Logs': ['SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'Manager'],
  // plant settings follow the server's tenant-setting write rule (TenantAdmin / manager_approver)
  Settings: ['SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'Manager'],
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
  it('every item is still listed, in section order', () => {
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

  it('Codes & Rules and Finance are v2 only: listed without any feature flag', () => {
    const names = visibleNavigationItems(capabilitiesOf(['SuperAdmin']), {}).map((item) => item.name);
    expect(names).toContain('Codes & Rules');
    expect(names).toContain('Finance');
    expect(names).toContain('Dashboard');
  });

  it('a master_data_admin (legacy Analyst) gains Master Data and nothing else', () => {
    const charlotte: RoleSubject = { ...legacyUser('Analyst'), scopes: [{ tenantId: HOME, role: 'production_engineer' }, { tenantId: HOME, role: 'master_data_admin' }] };
    expect(menuFor(charlotte)).toEqual([...menuFor(legacyUser('Analyst')), 'Master Data'].sort(byMenuOrder));
  });

  it('an integration_admin (legacy Engineer) gains Connectivity, and Master Data for the unit state page', () => {
    const elena: RoleSubject = { ...legacyUser('Engineer'), scopes: [{ tenantId: HOME, role: 'production_engineer' }, { tenantId: HOME, role: 'integration_admin' }] };
    expect(menuFor(elena)).toEqual([...menuFor(legacyUser('Engineer')), 'Connectivity', 'Master Data'].sort(byMenuOrder));
  });

  it('Master Data is listed for master-data admins and for every writer of one of its reliability pages', () => {
    const roleSets = [['master_data_admin'], ['manager_approver'], ['reliability_engineer'], ['operator'], ['integration_admin'], ['production_engineer'], ['viewer']];
    const listed = roleSets.map((roles) => visibleNavigationItems(capabilitiesOf(roles), FLAGS_ON).some((item) => item.name === 'Master Data'));
    expect(listed).toEqual([true, true, true, true, true, false, false]);
    for (const roles of roleSets) {
      const c = capabilitiesOf(roles);
      expect(c.canReachMasterData, roles.join()).toBe(c.canManageMasterData || c.canWriteOeePolicy || c.canWriteStandby || c.canWriteWorkOrders || c.canWriteStateMappings);
    }
  });

  it.each([
    ['Enhanced Historian', 'canViewAnalysis'],
    ['Admin Panel', 'canUseAdminPanel'],
    ['Audit Logs', 'canViewAuditLogs'],
  ] as const)('%s is listed exactly when its page gate (%s) admits the user', (name, gate) => {
    const roleSets = [
      ...ALL.map((role) => effectiveRoles(legacyUser(role), { tenantId: HOME })),
      ['Engineer', 'production_engineer', 'integration_admin'],
      ['Analyst', 'production_engineer', 'master_data_admin'],
      ['Engineer', 'production_engineer', 'reliability_engineer'],
      ['viewer'],
    ];
    for (const roles of roleSets) {
      const capabilities = capabilitiesOf(roles);
      const listed = visibleNavigationItems(capabilities, FLAGS_ON).some((item) => item.name === name);
      expect(listed, roles.join('+')).toBe(capabilities[gate]);
    }
  });

  it('a reliability engineer sees the historian (a read screen) but not the audit trail (server: FORBIDDEN_ROLE)', () => {
    const amara: RoleSubject = { ...legacyUser('Engineer'), scopes: [{ tenantId: HOME, role: 'reliability_engineer' }] };
    expect(menuFor(amara)).not.toContain('Audit Logs');
    expect(menuFor(amara)).toContain('Enhanced Historian');
    // standby log and CMMS work orders
    expect(menuFor(amara)).toContain('Master Data');
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

describe('navigation sections', () => {
  const sectionsOf = (role: string) =>
    groupNavigationItems(visibleNavigationItems(capabilitiesOf(effectiveRoles(legacyUser(role), { tenantId: HOME })), FLAGS_ON)).map(
      (group) => group.section.key,
    );

  it('every item belongs to a known section and items are listed section by section', () => {
    const keys = NAV_SECTIONS.map((section) => section.key);
    const positions = NAVIGATION_ITEMS.map((item) => keys.indexOf(item.section));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('every item has its own icon', () => {
    expect(new Set(NAVIGATION_ITEMS.map((item) => item.icon)).size).toBe(NAVIGATION_ITEMS.length);
  });

  it.each([
    ['SuperAdmin', ['overview', 'production', 'reliability', 'integration', 'administration']],
    ['TenantAdmin', ['overview', 'production', 'reliability', 'integration', 'administration']],
    ['Manager', ['overview', 'production', 'reliability', 'integration', 'administration']],
    ['Engineer', ['overview', 'production', 'reliability', 'integration', 'administration']],
    // operators keep the standby log: Master Data (its standby page) brings the administration section
    ['Operator', ['overview', 'production', 'reliability', 'administration']],
  ])('a %s sees only the sections that hold one of its items', (role, sections) => {
    expect(sectionsOf(role)).toEqual(sections);
  });

  it('a viewer in a plant where it has no role sees no section at all', () => {
    expect(groupNavigationItems(visibleNavigationItems(capabilitiesOf([]), FLAGS_ON))).toEqual([]);
  });

  it('active item: own path and sub-paths only, plus activeAlso prefixes', () => {
    const byHref = (href: string) => NAVIGATION_ITEMS.find((item) => item.href === href)!;
    expect(isNavItemActive(byHref('/rca'), '/rca')).toBe(true);
    expect(isNavItemActive(byHref('/rca'), '/rca/cases/1')).toBe(true);
    expect(isNavItemActive(byHref('/rca'), '/rca-knowledge-base')).toBe(false);
    expect(isNavItemActive(byHref('/rca-knowledge-base'), '/rca-knowledge-base')).toBe(true);
    expect(isNavItemActive(byHref('/planning'), '/plans/p1/periods/x')).toBe(true);
    expect(isNavItemActive(byHref('/planning'), '/planning/plans/p1')).toBe(true);
  });
});

const order = new Map(NAVIGATION_ITEMS.map((item, index) => [item.name, index]));
function byMenuOrder(a: string, b: string): number {
  return (order.get(a) ?? 0) - (order.get(b) ?? 0);
}
