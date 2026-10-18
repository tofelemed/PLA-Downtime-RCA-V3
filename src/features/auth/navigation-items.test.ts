import { describe, expect, it } from 'vitest';
import type { FeatureFlagKey } from '@/api/v2/types/flags';
import { capabilitiesOf } from './capabilities';
import { effectiveRoles, type RoleSubject } from './effective-roles';
import { activeNavItem, groupNavigationItems, isNavItemActive, NAV_SECTIONS, NAVIGATION_ITEMS, visibleNavigationItems } from './navigation-items';

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
  'Pending Approvals': ALL,
  Reports: NOT_OPERATOR,
  // Production
  'Event Hub': ALL,
  'Plans, Profiles & Calendars': NOT_OPERATOR,
  // EXPERT_REVIEW Area 3: my reconciliation queue (period writers, R-C) and month close (analysis roles, R-B)
  // Marun E2E: operators own RCA actions and tasks, so they reach My work and RCA Analysis
  'My work': ALL,
  'Month Close': NOT_OPERATOR,
  // SME E4 uncertainty budgets: read by every analysis role
  'Measurement Uncertainty': NOT_OPERATOR,
  // Focused analysis pages use the same read capability as the original two pages.
  'Downtime Analysis': ALL,
  'Stops & Timeline': ALL,
  'Causes & Pareto': ALL,
  'Trends & Comparisons': ALL,
  'Downtime Reliability': ALL,
  'Production Loss Analysis': ALL,
  'Loss Breakdown': ALL,
  'PLA Trends': ALL,
  OEE: ALL,
  'Reconciliation & Data Quality': ALL,
  'Loss Valuation': ALL,
  // UX audit B-5: the period grid, gated like Plans, Profiles & Calendars
  'Period accounting': NOT_OPERATOR,
  // Reliability
  'RCA Analysis': ALL,
  'Bad Actors': NOT_OPERATOR,
  'Knowledge Base': NOT_OPERATOR,
  Tasks: ALL,
  // Integration: owner 18 Oct 2026, SuperAdmin only (approvers reach their two review pages from the inbox)
  Connectivity: ['SuperAdmin'],
  'Source Status Rules': ['SuperAdmin'],
  'Source Priority': ['SuperAdmin'],
  'Enhanced Historian': ['SuperAdmin'],
  // Administration: Master Data also for the writers of its reliability pages (Manager = manager_approver:
  // stop and plan policy; Operator = operator: standby log); they see only those pages' links
  'Equipment Setup Guide': ALL,
  'Master Data': ALL,
  Finance: NOT_OPERATOR,
  'User Management': [...ADMINS, 'Manager'],
  // SME R1 / R6: administrators for anyone, approval-role holders (Manager = manager_approver) for themselves
  'Admin Panel': [...ADMINS, 'Manager'],
  'Audit Logs': ['SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'Manager'],
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
    expect(names).toContain('Master Data');
    expect(names).not.toContain('Codes & Rules');
    expect(names).toContain('Finance');
    expect(names).toContain('Dashboard');
  });

  it('a master_data_admin (legacy Analyst) gains Master Data and nothing else', () => {
    const charlotte: RoleSubject = { ...legacyUser('Analyst'), scopes: [{ tenantId: HOME, role: 'production_engineer' }, { tenantId: HOME, role: 'master_data_admin' }] };
    expect(menuFor(charlotte)).toEqual(menuFor(legacyUser('Analyst')));
  });

  it('an integration_admin (legacy Engineer) gains no Integration item: the section is SuperAdmin-only (owner 18 Oct 2026)', () => {
    const elena: RoleSubject = { ...legacyUser('Engineer'), scopes: [{ tenantId: HOME, role: 'production_engineer' }, { tenantId: HOME, role: 'integration_admin' }] };
    expect(menuFor(elena)).toEqual(menuFor(legacyUser('Engineer')));
  });

  it('only SuperAdmin sees the Integration section; production accounting reaches Source Priority / Status Rules by route only', () => {
    const integration = (roles: string[]) =>
      groupNavigationItems(visibleNavigationItems(capabilitiesOf(roles), FLAGS_ON)).some((group) => group.section.key === 'integration');
    expect(integration(['SuperAdmin'])).toBe(true);
    for (const roles of [['OrgAdmin'], ['TenantAdmin'], ['integration_admin'], ['production_accountant'], ['manager_approver'], ['viewer']]) {
      expect([roles.join(), integration(roles)]).toEqual([roles.join(), false]);
    }
    const accountant = capabilitiesOf(['production_accountant']);
    expect([accountant.canReachIntegration, accountant.canReviewSourcePriority, accountant.canReviewSourceStatusRules]).toEqual([false, true, true]);
    const admin = capabilitiesOf(['integration_admin']);
    expect([admin.canReachIntegration, admin.canReviewSourcePriority, admin.canReviewSourceStatusRules]).toEqual([false, false, false]);
  });

  it('Master Data is listed for master-data admins and for every writer of one of its reliability pages', () => {
    const roleSets = [['master_data_admin'], ['manager_approver'], ['reliability_engineer'], ['operator'], ['integration_admin'], ['production_engineer'], ['viewer']];
    const listed = roleSets.map((roles) => visibleNavigationItems(capabilitiesOf(roles), FLAGS_ON).some((item) => item.name === 'Master Data'));
    expect(listed).toEqual([true, true, true, true, true, true, true]);
    for (const roles of roleSets) {
      const c = capabilitiesOf(roles);
      expect(c.canReachMasterData, roles.join()).toBe(c.canViewAnalysis || c.canManageMasterData || c.canWriteOeePolicy || c.canWriteStandby || c.canWriteWorkOrders || c.canWriteStateMappings);
    }
  });

  it.each([
    ['Equipment Setup Guide', 'canReachMasterData'],
    ['Enhanced Historian', 'canReachIntegration'],
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

  it('a reliability engineer sees neither the historian (Integration is SuperAdmin-only) nor the audit trail (server: FORBIDDEN_ROLE)', () => {
    const amara: RoleSubject = { ...legacyUser('Engineer'), scopes: [{ tenantId: HOME, role: 'reliability_engineer' }] };
    expect(menuFor(amara)).not.toContain('Audit Logs');
    expect(menuFor(amara)).not.toContain('Enhanced Historian');
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
    ['SuperAdmin', ['overview', 'production', 'downtime', 'pla', 'reliability', 'integration', 'administration']],
    // owner 18 Oct 2026: the Integration section is SuperAdmin-only
    ['TenantAdmin', ['overview', 'production', 'downtime', 'pla', 'reliability', 'administration']],
    ['Manager', ['overview', 'production', 'downtime', 'pla', 'reliability', 'administration']],
    ['Engineer', ['overview', 'production', 'downtime', 'pla', 'reliability', 'administration']],
    // operators keep the standby log: Master Data (its standby page) brings the administration section
    ['Operator', ['overview', 'production', 'downtime', 'pla', 'reliability', 'administration']],
  ])('a %s sees only the sections that hold one of its items', (role, sections) => {
    expect(sectionsOf(role)).toEqual(sections);
  });

  it('a viewer in a plant where it has no role sees no section at all', () => {
    expect(groupNavigationItems(visibleNavigationItems(capabilitiesOf([]), FLAGS_ON))).toEqual([]);
  });

  it('active item: own path and sub-paths only, plus activeAlso prefixes', () => {
    const byHref = (href: string) => NAVIGATION_ITEMS.find((item) => item.href === href)!;
    expect(isNavItemActive(byHref('/equipment-setup'), '/equipment-setup')).toBe(true);
    expect(isNavItemActive(byHref('/admin'), '/equipment-setup')).toBe(false);
    expect(isNavItemActive(byHref('/master-data'), '/equipment-setup')).toBe(false);
    expect(byHref('/equipment-setup').section).toBe('administration');
    expect(isNavItemActive(byHref('/rca'), '/rca')).toBe(true);
    expect(isNavItemActive(byHref('/rca'), '/rca/cases/1')).toBe(true);
    expect(isNavItemActive(byHref('/rca'), '/rca-knowledge-base')).toBe(false);
    expect(isNavItemActive(byHref('/rca-knowledge-base'), '/rca-knowledge-base')).toBe(true);
    expect(isNavItemActive(byHref('/planning'), '/plans/p1/periods/x')).toBe(true);
    expect(isNavItemActive(byHref('/planning'), '/planning/plans/p1')).toBe(true);
  });

  it.each([
    ['/connectivity/source-status', '/connectivity/source-status'],
    ['/connectivity/source-authority', '/connectivity/source-authority'],
    ['/connectivity/source-authority/v2', '/connectivity/source-authority'],
    ['/connectivity', '/connectivity'],
    ['/connectivity/jobs', '/connectivity'],
    ['/plans/p1/periods/x', '/planning'],
  ])('one highlighted item for %s: the longest match (%s)', (pathname, href) => {
    expect(activeNavItem(NAVIGATION_ITEMS, pathname)?.href).toBe(href);
  });

  it('no highlighted item for a path outside the menu', () => {
    expect(activeNavItem(NAVIGATION_ITEMS, '/nowhere')).toBeUndefined();
  });

  it('lists no development-only item without a route', () => {
    expect(NAVIGATION_ITEMS.some((item) => item.href === '/data-seeding')).toBe(false);
  });
});
