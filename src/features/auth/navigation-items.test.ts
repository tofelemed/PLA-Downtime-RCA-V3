import { describe, expect, it } from 'vitest';
import type { FeatureFlagKey } from '@/api/v2/types/flags';
import { capabilitiesOf } from './capabilities';
import { effectiveRoles, type RoleSubject } from './effective-roles';
import { activeNavItem, groupNavigationItems, isNavItemActive, NAV_SECTIONS, NAVIGATION_ITEMS, visibleNavigationItems } from './navigation-items';

/**
 * The menu of each legacy demo user in its home plant (one legacy-role list per item): the menu
 * Navigation.tsx listed before capabilities, except where an item now follows its page gate or the
 * server's read roles (Admin Panel, Enhanced Historian, Audit Logs; APPLICATION_LOGIC_GUIDE Â§23).
 */
const ALL = ['SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'Manager', 'Analyst', 'Engineer', 'Operator'];
const NOT_OPERATOR = ['SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'Manager', 'Analyst', 'Engineer'];
const ADMINS = ['SuperAdmin', 'OrgAdmin', 'TenantAdmin'];
const PREVIOUS_MENU: Record<string, string[]> = {
  // Overview
  Dashboard: ALL,
  Reports: NOT_OPERATOR,
  // QA re-test 19 Oct (W-OP): roles that decide an inbox kind (operators decide duplicate-stop merges)
  'Pending approvals': ALL,
  // Production
  'Event Hub': ALL,
  // owner 21 Oct 2026: plans stay here; profiles and calendars moved to Setup
  Plans: NOT_OPERATOR,
  // EXPERT_REVIEW Area 3: my reconciliation queue (period writers, R-C) and month close (analysis roles, R-B)
  // Marun E2E: operators own RCA actions and tasks, so they reach My work and RCA Analysis
  'My work': ALL,
  'Month close': NOT_OPERATOR,
  // SME E4 uncertainty budgets: read by every analysis role
  'Measurement uncertainty': NOT_OPERATOR,
  // PLA, then Downtime (owner 22 Oct 2026). Focused analysis pages use the same read capability as the original two pages.
  'Production loss analysis': ALL,
  'Loss breakdown': ALL,
  'PLA trends': ALL,
  OEE: ALL,
  'Reconciliation & data quality': ALL,
  // owner 19 Oct 2026 (QA audit): no money for operators (canViewMoney)
  'Loss valuation': NOT_OPERATOR,
  // item 1.2: approved rate kinds side by side (quantities only, no money)
  'Capacity gap': ALL,
  // UX audit B-5: the period grid, gated like Plans, Profiles & Calendars
  'Period accounting': NOT_OPERATOR,
  // Downtime analysis
  'Downtime analysis': ALL,
  'Stops & timeline': ALL,
  'Causes & Pareto': ALL,
  'Trends & comparisons': ALL,
  'Reliability (MTBF/MTTR)': ALL,
  // Reliability
  'RCA Analysis': ALL,
  'Bad actors': NOT_OPERATOR,
  // item 1.1: recurring-cause ranking, gated like Bad actors
  'Recurring causes': NOT_OPERATOR,
  // item 2.1: loss → cause → action → outcome, gated like Recurring causes
  'Cause portfolio': NOT_OPERATOR,
  'Knowledge base': NOT_OPERATOR,
  // from master data (21 Oct 2026): master-data administrators and work-order writers (Manager)
  'Work-order operations': [...ADMINS, 'Manager'],
  Tasks: ALL,
  // Setup (owner 21 Oct 2026), in the order of the setup guide's phases; each entry is listed for whoever may
  // open one of its pages (Manager = profile and stop-policy writer; Operator = standby log writer)
  // QA re-test 19 Oct (L16): the guide is a configuration journey, not for operations-only roles
  'Equipment setup guide': NOT_OPERATOR,
  // owner 22 Oct 2026: moved from the Admin panel (its tab was shown to the plant's administrators)
  'Organizations & plants': ADMINS,
  'Plant & equipment': [...ADMINS, 'Manager'],
  'Codes & failures': ALL,
  'Production rules': [...ADMINS, 'Manager', 'Operator'],
  'Calendars & crews': NOT_OPERATOR,
  'Profiles & rates': NOT_OPERATOR,
  'RCA library': ADMINS,
  Valuation: NOT_OPERATOR,
  // Integration: owner 18 Oct 2026, SuperAdmin only (approvers reach their two review pages from the inbox)
  Connectivity: ['SuperAdmin'],
  'Source status rules': ['SuperAdmin'],
  'Source priority': ['SuperAdmin'],
  'Enhanced historian': ['SuperAdmin'],
  // QA re-test 19 Oct: administrators; approval-role holders (Manager = manager_approver) record their own
  // delegations under "Approval delegations" (SME R1 / R6)
  'User management': ADMINS,
  'Approval delegations': ['Manager'],
  'Admin panel': [...ADMINS, 'Manager'],
  'Audit log': ['SuperAdmin', 'OrgAdmin', 'TenantAdmin', 'Manager'],
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

  it('Codes & failures and Valuation are v2 only: listed without any feature flag', () => {
    const names = visibleNavigationItems(capabilitiesOf(['SuperAdmin']), {}).map((item) => item.name);
    expect(names).toContain('Codes & failures');
    expect(names).not.toContain('Codes & Rules');
    expect(names).toContain('Valuation');
    expect(names).toContain('Dashboard');
  });

  it('a master_data_admin (legacy Analyst) gains the setup pages it administers', () => {
    const charlotte: RoleSubject = { ...legacyUser('Analyst'), scopes: [{ tenantId: HOME, role: 'production_engineer' }, { tenantId: HOME, role: 'master_data_admin' }] };
    const gained = menuFor(charlotte).filter((name) => !menuFor(legacyUser('Analyst')).includes(name));
    expect(gained).toEqual(['Work-order operations', 'Plant & equipment', 'Production rules', 'RCA library']);
  });

  it('an integration_admin (legacy Engineer) gains no Integration item: the section is SuperAdmin-only (owner 18 Oct 2026)', () => {
    const elena: RoleSubject = { ...legacyUser('Engineer'), scopes: [{ tenantId: HOME, role: 'production_engineer' }, { tenantId: HOME, role: 'integration_admin' }] };
    // no Integration item; it writes unit-state mappings and work orders, so those Setup / Reliability pages
    // (21 Oct 2026)
    const gained = menuFor(elena).filter((name) => !menuFor(legacyUser('Engineer')).includes(name));
    expect(gained).toEqual(['Work-order operations', 'Production rules']);
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

  it('each setup page group is listed for whoever may open one of its pages (21 Oct 2026)', () => {
    const roleSets = [['master_data_admin'], ['manager_approver'], ['reliability_engineer'], ['operator'], ['viewer']];
    const listed = (name: string) => roleSets.map((roles) => visibleNavigationItems(capabilitiesOf(roles), FLAGS_ON).some((item) => item.name === name));
    expect(listed('Production rules')).toEqual([true, true, true, true, false]);
    expect(listed('Work-order operations')).toEqual([true, true, true, false, false]);
    expect(listed('RCA library')).toEqual([true, false, false, false, false]);
    expect(listed('Codes & failures')).toEqual([true, true, true, true, true]);
    for (const roles of roleSets) {
      const c = capabilitiesOf(roles);
      expect(c.canReachMasterData, roles.join()).toBe(c.canViewAnalysis || c.canManageMasterData || c.canWriteOeePolicy || c.canWriteStandby || c.canWriteWorkOrders || c.canWriteStateMappings);
    }
  });

  it.each([
    ['Equipment setup guide', 'canReachSetupGuide'],
    ['Pending approvals', 'canReachApprovals'],
    ['User management', 'canUseUserManagement'],
    ['Approval delegations', 'canReachDelegationsOnly'],
    ['Enhanced historian', 'canReachIntegration'],
    ['Admin panel', 'canUseAdminPanel'],
    ['Organizations & plants', 'canAdministerTenant'],
    ['Audit log', 'canViewAuditLogs'],
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
    expect(menuFor(amara)).not.toContain('Audit log');
    expect(menuFor(amara)).not.toContain('Enhanced historian');
    // standby log and CMMS work orders
    expect(menuFor(amara)).toContain('Production rules');
    expect(menuFor(amara)).toContain('Work-order operations');
  });

  it('a viewer in another plant sees the read screens only', () => {
    const grace: RoleSubject = {
      role: 'Operator',
      tenantId: 'plant-demo-2',
      homeTenantId: 'plant-demo-2',
      organizationId: 'org-demo',
      scopes: [{ tenantId: 'plant-demo-2', role: 'operator' }, { tenantId: HOME, role: 'viewer' }],
    };
    // a viewer decides no approval (QA re-test 19 Oct, W-OP)
    expect(menuFor(grace, HOME)).toEqual(menuFor(legacyUser('Engineer')).filter((name) => name !== 'Pending approvals'));
    expect(menuFor(grace, 'plant-demo-2')).toEqual(menuFor(legacyUser('Operator')));
    expect(menuFor(grace, 'plant-partner')).toEqual([]);
  });
});

describe('menus of the guide roles (QA re-test 19 Oct)', () => {
  const menuOf = (role: string) => visibleNavigationItems(capabilitiesOf([role]), FLAGS_ON).map((item) => item.name);

  it.each(['finance_maintainer', 'master_data_admin', 'integration_admin'])('%s has no Pending approvals: it decides no inbox kind', (role) => {
    expect(menuOf(role)).not.toContain('Pending approvals');
  });

  it.each(['finance_approver', 'production_accountant', 'quality_approver', 'metrology_approver', 'manager_approver'])('%s records its own delegations under "Approval delegations", not User management', (role) => {
    expect(menuOf(role)).toContain('Approval delegations');
    expect(menuOf(role)).not.toContain('User management');
  });

  it('an operator decides duplicate-stop merges (Pending approvals) but has no Equipment setup guide', () => {
    expect(menuOf('operator')).toContain('Pending approvals');
    expect(menuOf('operator')).not.toContain('Equipment setup guide');
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

  it('sections in display order (owner 22 Oct 2026): Overview, Production, PLA, Downtime, Reliability, then setup and admin', () => {
    expect(NAV_SECTIONS.map((section) => section.key)).toEqual(['overview', 'production', 'pla', 'downtime', 'reliability', 'setup', 'integration', 'administration']);
    expect(NAVIGATION_ITEMS.filter((item) => item.section === 'overview').map((item) => item.name)).toEqual(['Dashboard', 'Reports', 'Pending approvals']);
  });

  it('every item has its own icon', () => {
    expect(new Set(NAVIGATION_ITEMS.map((item) => item.icon)).size).toBe(NAVIGATION_ITEMS.length);
  });

  it.each([
    ['SuperAdmin', ['overview', 'production', 'pla', 'downtime', 'reliability', 'setup', 'integration', 'administration']],
    // owner 18 Oct 2026: the Integration section is SuperAdmin-only
    ['TenantAdmin', ['overview', 'production', 'pla', 'downtime', 'reliability', 'setup', 'administration']],
    ['Manager', ['overview', 'production', 'pla', 'downtime', 'reliability', 'setup', 'administration']],
    // engineers and operators have no administration page any more (master data and finance moved to Setup)
    ['Engineer', ['overview', 'production', 'pla', 'downtime', 'reliability', 'setup']],
    // operators keep the standby log (Production rules) and read the code libraries (Codes & failures)
    ['Operator', ['overview', 'production', 'pla', 'downtime', 'reliability', 'setup']],
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
    expect(isNavItemActive(byHref('/master-data/units'), '/equipment-setup')).toBe(false);
    expect(byHref('/equipment-setup').section).toBe('setup');
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
    // Setup entries own their pages and the /planning sub-pages of profiles and calendars (21 Oct 2026)
    ['/planning/calendars/v1', '/setup/calendars'],
    ['/planning/profiles/p1/edit', '/setup/profiles'],
    ['/planning/plans/p1', '/planning'],
    ['/master-data/assets/a1', '/master-data/units'],
    ['/master-data/failure-dictionary', '/master-data/codes-rules'],
    ['/master-data/unit-state', '/master-data/stop-policy'],
    ['/master-data/rca/causes', '/master-data/rca/templates'],
    ['/master-data/work-orders', '/master-data/work-orders'],
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
