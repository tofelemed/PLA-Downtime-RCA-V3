import { DOWNTIME_PAGES, PLA_PAGES } from '@/features/analysis-navigation/analysis-pages';
import { EntityIcon, type AppIcon } from '@/lib/icons';
import type { FeatureFlagKey } from '@/api/v2/types/flags';
import type { Capabilities, CapabilityKey } from './capabilities';

/** Sidebar sections; `NAV_SECTIONS` gives the display order (owner 22 Oct 2026: PLA before Downtime). */
export type NavSectionKey = 'overview' | 'production' | 'pla' | 'downtime' | 'reliability' | 'setup' | 'integration' | 'administration';

export interface NavSection {
  key: NavSectionKey;
  label: string;
  icon: AppIcon;
}

export const NAV_SECTIONS: readonly NavSection[] = [
  { key: 'overview', label: 'Overview', icon: EntityIcon.dashboard },
  { key: 'production', label: 'Daily operations', icon: EntityIcon.plant },
  { key: 'pla', label: 'Production loss analysis (PLA)', icon: EntityIcon.lossAnalysis },
  { key: 'downtime', label: 'Downtime analysis', icon: EntityIcon.downtime },
  { key: 'reliability', label: 'Asset reliability', icon: EntityIcon.rcaCase },
  { key: 'setup', label: 'Configuration', icon: EntityIcon.equipmentSetup },
  { key: 'integration', label: 'Integration', icon: EntityIcon.integration },
  { key: 'administration', label: 'Administration', icon: EntityIcon.administration },
];

export interface NavigationItem {
  name: string;
  label?: string;
  exact?: boolean;
  href: string;
  icon: AppIcon;
  section: NavSectionKey;
  /** the capability (of the selected plant) that lists the item */
  capability: CapabilityKey;
  description: string;
  /** listed only while the flag is on for the plant */
  flag?: FeatureFlagKey;
  /** other path prefixes that belong to this item (e.g. `/plans/` sub-pages of Production Plans) */
  activeAlso?: readonly string[];
}

/** Both analysis sections start with an "Overview" page; the sidebar names them apart (UX audit B-1). */
function sidebarLabel(page: { key: string; label: string }, overviewLabel: string): string {
  return page.key === 'overview' ? overviewLabel : page.label;
}

/**
 * The sidebar, section by section and in order. Each entry names the capability that shows it, so a
 * scope role (e.g. `master_data_admin`, `integration_admin`, `viewer`) reaches the same screens its API
 * rights cover. Every item has its own icon from the registry (`src/lib/icons.ts`).
 */
export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: EntityIcon.dashboard, section: 'overview', capability: 'canViewOperations', description: 'Key figures of the selected plant' },
  { name: 'Reports', href: '/reports', icon: EntityIcon.report, section: 'overview', capability: 'canViewAnalysis', description: 'OEE, loss, downtime and reconciliation reports' },
  { name: 'Pending approvals', href: '/approvals', icon: EntityIcon.approvals, section: 'overview', capability: 'canReachApprovals', description: 'Pending records for your approval roles in the selected plant' },
  { name: 'Event Hub', href: '/events', icon: EntityIcon.event, section: 'production', capability: 'canViewOperations', description: 'Stops and production events' },
  {
    // owner 21 Oct 2026: plans are made every period, so they stay here; profiles and calendars moved to Setup
    name: 'Plans',
    href: '/planning',
    icon: EntityIcon.planning,
    section: 'production',
    capability: 'canViewAnalysis',
    description: 'Production plans, their versions and period accounting',
    activeAlso: ['/plans/'],
  },
  {
    // UX audit §5.7: "My work" (route kept); tabs Periods · RCA actions · Tasks
    name: 'My work',
    href: '/my-queue',
    icon: EntityIcon.plan,
    section: 'production',
    // a read screen: the server lists only what the caller's roles can act on (empty for read-only roles);
    // operators reach it for their RCA actions and tasks (Marun E2E owner rule)
    capability: 'canViewOperations',
    description: 'Periods to prepare or review, your RCA actions and your tasks',
  },
  {
    name: 'Month close',
    href: '/month-close',
    icon: EntityIcon.calendar,
    section: 'production',
    capability: 'canViewAnalysis',
    description: 'Close the plant month: approvals, quantity close, finance sign-off and lock',
  },
  {
    // SME E4: every analysis role reads; production / integration / accounting record, accounting approves
    name: 'Measurement uncertainty',
    href: '/measurement-uncertainty',
    icon: EntityIcon.signal,
    section: 'production',
    capability: 'canViewAnalysis',
    description: 'Uncertainty budgets per measurement boundary that justify the reconciliation tolerance',
  },
  // owner 19 Oct 2026 (QA audit): no money for operators, so Loss valuation needs canViewMoney (menu and route gate)
  ...PLA_PAGES.map((page): NavigationItem => ({ name: page.name, label: sidebarLabel(page, 'PLA overview'), href: page.path, icon: page.icon, section: 'pla', capability: page.key === 'valuation' ? 'canViewMoney' : 'canViewOperations', description: page.description, exact: true })),
  {
    // UX audit B-5: resolves the plan (`/period-accounting` → `/plans/:id`, or the plan list) on click, not on every render
    name: 'Period accounting',
    href: '/period-accounting',
    icon: EntityIcon.periodAccounting,
    section: 'pla',
    capability: 'canViewAnalysis',
    description: "Period grid of the unit's active approved plan; the plan list when several plans are active",
  },
  ...DOWNTIME_PAGES.map((page): NavigationItem => ({ name: page.name, label: sidebarLabel(page, 'Downtime overview'), href: page.path, icon: page.icon, section: 'downtime', capability: 'canViewOperations', description: page.description, exact: true })),
  // operators see their RCA actions and the investigations they belong to, read-only (Marun E2E owner rule)
  { name: 'RCA Analysis', href: '/rca', icon: EntityIcon.rcaCase, section: 'reliability', capability: 'canViewOperations', description: 'Root cause investigations' },
  { name: 'Bad actors', href: '/reliability/bad-actors', icon: EntityIcon.badActor, section: 'reliability', capability: 'canViewAnalysis', description: 'Monthly top assets and failure modes by approved loss' },
  { name: 'Recurring causes', href: '/reliability/causes', icon: EntityIcon.recurringCause, section: 'reliability', capability: 'canViewAnalysis', description: 'Cause codes ranked by investigations and their approved loss' },
  { name: 'Cause portfolio', href: '/reliability/portfolio', icon: EntityIcon.rcaPortfolio, section: 'reliability', capability: 'canViewAnalysis', description: 'Approved loss, actions and outcomes of investigations by coded cause' },
  { name: 'Knowledge base', href: '/rca-knowledge-base', icon: EntityIcon.knowledge, section: 'reliability', capability: 'canViewAnalysis', description: 'Closed investigations and lessons learned' },
  { name: 'Work-order operations', href: '/master-data/work-orders', icon: EntityIcon.workOrder, section: 'reliability', capability: 'canReachWorkOrders', description: 'CMMS operations behind mean active repair time' },
  { name: 'Tasks', href: '/tasks', icon: EntityIcon.task, section: 'reliability', capability: 'canViewOperations', description: 'Assign and track tasks' },
  // owner 21 Oct 2026: everything that sets a plant up, in the order of the setup guide's phases
  { name: 'Equipment setup guide', label: 'Setup guide', href: '/equipment-setup', icon: EntityIcon.equipmentSetup, section: 'setup', capability: 'canReachSetupGuide', description: 'Six phases from equipment records to the first approved period and analysis' },
  // owner 22 Oct 2026: organizations and plants moved here from the Admin panel; administrators of the plant read
  // it and manage its sites, creating plants stays with SuperAdmin / OrgAdmin (`canManagePlants`)
  { name: 'Organizations & plants', href: '/setup/plants', icon: EntityIcon.organization, section: 'setup', capability: 'canAdministerTenant', description: 'Organizations, their plants and the sites of the selected plant' },
  { name: 'Plant & equipment', href: '/master-data/units', icon: EntityIcon.asset, section: 'setup', capability: 'canReachPlantEquipment', activeAlso: ['/master-data/assets', '/master-data/products', '/master-data/hierarchy', '/master-data/plant-flow'], description: 'Production units, assets, products, the plant hierarchy and plant flow' },
  { name: 'Codes & failures', href: '/master-data/codes-rules', icon: EntityIcon.codeLibrary, section: 'setup', capability: 'canReachCodesSetup', activeAlso: ['/master-data/failure-dictionary', '/codes-admin'], description: 'Code libraries, reason codes, automatic rules and the failure dictionary' },
  { name: 'Production rules', href: '/master-data/stop-policy', icon: EntityIcon.productionRules, section: 'setup', capability: 'canReachProductionRules', activeAlso: ['/master-data/unit-impact-rules', '/master-data/standby-equipment', '/master-data/unit-state'], description: 'Stop and plan policy, unit impact rules, standby equipment and unit state' },
  { name: 'Calendars & crews', href: '/setup/calendars', icon: EntityIcon.shiftCalendar, section: 'setup', capability: 'canViewAnalysis', activeAlso: ['/planning/calendars'], description: 'Shift calendars, crews and rotations' },
  { name: 'Profiles & rates', href: '/setup/profiles', icon: EntityIcon.product, section: 'setup', capability: 'canViewAnalysis', activeAlso: ['/planning/profiles'], description: 'Unit and product profiles, production rates, grade transitions and streams' },
  { name: 'RCA library', href: '/master-data/rca/templates', icon: EntityIcon.rcaLibrary, section: 'setup', capability: 'canManageMasterData', activeAlso: ['/master-data/rca/'], description: 'Investigation templates, the cause library and verification checklists' },
  { name: 'Valuation', href: '/finance', icon: EntityIcon.finance, section: 'setup', capability: 'canViewAnalysis', description: 'Valuation policy and exchange rates' },
  // owner 18 Oct 2026: the whole Integration section is SuperAdmin-only (menu and routes); approvers of Source
  // Priority / Source Status Rules reach those two review pages from the approvals inbox (route gates below)
  { name: 'Connectivity', href: '/connectivity', icon: EntityIcon.connection, section: 'integration', capability: 'canReachIntegration', description: 'Connections, ingestion jobs and mappings' },
  { name: 'Source status rules', href: '/connectivity/source-status', icon: EntityIcon.rule, section: 'integration', capability: 'canReachIntegration', description: 'Which source statuses count as the released record, per source system' },
  { name: 'Source priority', href: '/connectivity/source-authority', icon: EntityIcon.library, section: 'integration', capability: 'canReachIntegration', description: 'Which measurement source counts for each unit, and the versions waiting for approval' },
  { name: 'Enhanced historian', href: '/enhanced-historian', icon: EntityIcon.historian, section: 'integration', capability: 'canReachIntegration', description: 'Time series of plant signals' },
  { name: 'User management', href: '/users', icon: EntityIcon.team, section: 'administration', capability: 'canUseUserManagement', activeAlso: ['/permissions'], description: 'Users, permissions and approval delegations' },
  // SME R1 / R6: administrators record delegations for anyone (User management › Delegations), approval-role
  // holders for themselves: QA re-test 2026-10-19, their own entry instead of "User management"
  { name: 'Approval delegations', href: '/delegations', icon: EntityIcon.delegation, section: 'administration', capability: 'canReachDelegationsOnly', description: 'Hand your approval role to a colleague for an absence' },
  // the page's gate: TenantAdmin gets the plant-level tabs, the application-wide ones stay SuperAdmin-only
  { name: 'Admin panel', href: '/admin', activeAlso: ['/settings'], icon: EntityIcon.admin, section: 'administration', capability: 'canUseAdminPanel', description: 'Branding, custom attributes and plant settings' },
  { name: 'Audit log', href: '/audit', icon: EntityIcon.audit, section: 'administration', capability: 'canViewAuditLogs', description: 'Who changed what, and when' },
];

/**
 * QA M9: the one name of a menu page (sentence case, docs/GLOSSARY.md), shared by the menu, the page h1 /
 * tab title, the breadcrumb and the route gate's No-access title. Throws for a path outside the menu so a
 * renamed or removed item fails loudly in tests instead of drifting.
 */
export function pageNameOf(href: string, items: readonly NavigationItem[] = NAVIGATION_ITEMS): string {
  const item = items.find((candidate) => candidate.href === href);
  if (!item) throw new Error(`No menu page at ${href}`);
  return item.name;
}

/** The name the sidebar shows for an item ("Downtime overview", "Trends"); every list of menu pages uses it (QA_SHELL N3). */
export function sidebarNameOf(item: Pick<NavigationItem, 'name' | 'label'>): string {
  return item.label ?? item.name;
}

/** The items the user sees: capability held in the selected plant and, when flagged, the flag on. */
export function visibleNavigationItems(
  capabilities: Capabilities,
  flagsOn: Partial<Record<FeatureFlagKey, boolean>>,
  items: readonly NavigationItem[] = NAVIGATION_ITEMS,
): NavigationItem[] {
  return items.filter((item) => capabilities[item.capability] && (!item.flag || flagsOn[item.flag] === true));
}

export interface NavGroup {
  section: NavSection;
  items: NavigationItem[];
}

/** Visible items grouped by section, in section order; sections without a visible item are dropped. */
export function groupNavigationItems(items: readonly NavigationItem[], sections: readonly NavSection[] = NAV_SECTIONS): NavGroup[] {
  return sections
    .map((section) => ({ section, items: items.filter((item) => item.section === section.key) }))
    .filter((group) => group.items.length > 0);
}

/**
 * How specifically `pathname` belongs to the item: the length of the matched path (its own path, a
 * sub-path — `/rca/cases/1` is RCA, `/rca-knowledge-base` is not — or an `activeAlso` prefix); 0 when
 * it does not belong.
 */
export function navMatchLength(item: Pick<NavigationItem, 'href' | 'activeAlso' | 'exact'>, pathname: string): number {
  if (item.exact) return pathname === item.href ? item.href.length : 0;
  const own = pathname === item.href || pathname.startsWith(`${item.href}/`) ? item.href.length : 0;
  const also = (item.activeAlso ?? []).filter((prefix) => pathname.startsWith(prefix)).map((prefix) => prefix.length);
  return Math.max(own, ...also);
}

/** Whether `pathname` belongs to the item at all (several items may; `activeNavItem` picks one). */
export function isNavItemActive(item: Pick<NavigationItem, 'href' | 'activeAlso' | 'exact'>, pathname: string): boolean {
  return navMatchLength(item, pathname) > 0;
}

/**
 * The one item the menu highlights for `pathname`: the longest match wins, so
 * `/connectivity/source-status` is Source Status Rules, not also Connectivity.
 */
export function activeNavItem<T extends Pick<NavigationItem, 'href' | 'activeAlso' | 'exact'>>(items: readonly T[], pathname: string): T | undefined {
  let best: T | undefined;
  let bestLength = 0;
  for (const item of items) {
    const length = navMatchLength(item, pathname);
    if (length > bestLength) {
      best = item;
      bestLength = length;
    }
  }
  return best;
}

/** The flags the menu depends on (every `flag` named by an item). */
export const NAVIGATION_FLAGS: readonly FeatureFlagKey[] = [
  ...new Set(NAVIGATION_ITEMS.flatMap((item) => (item.flag ? [item.flag] : []))),
];
