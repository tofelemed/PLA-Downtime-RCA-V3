import { EntityIcon, type AppIcon } from '@/lib/icons';
import type { FeatureFlagKey } from '@/api/v2/types/flags';
import type { Capabilities, CapabilityKey } from './capabilities';

/** Sidebar sections, in display order (docs/UI_UX_AUDIT.md §1). */
export type NavSectionKey = 'overview' | 'production' | 'reliability' | 'integration' | 'administration';

export interface NavSection {
  key: NavSectionKey;
  label: string;
  icon: AppIcon;
}

export const NAV_SECTIONS: readonly NavSection[] = [
  { key: 'overview', label: 'Overview', icon: EntityIcon.dashboard },
  { key: 'production', label: 'Production', icon: EntityIcon.plant },
  { key: 'reliability', label: 'Reliability', icon: EntityIcon.rcaCase },
  { key: 'integration', label: 'Integration', icon: EntityIcon.integration },
  { key: 'administration', label: 'Administration', icon: EntityIcon.administration },
];

export interface NavigationItem {
  name: string;
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

const DEV_ITEMS: readonly NavigationItem[] = import.meta.env.DEV
  ? [
      // legacy demo seeding: development builds only (plan 3.1 step 7, decision A4)
      {
        name: 'Data Seeding',
        href: '/data-seeding',
        icon: EntityIcon.dataSource,
        section: 'administration',
        capability: 'canAdministerTenant',
        description: 'Manage test data for PLA and RCA',
      },
    ]
  : [];

/**
 * The sidebar, section by section and in order. Each entry names the capability that shows it, so a
 * scope role (e.g. `master_data_admin`, `integration_admin`, `viewer`) reaches the same screens its API
 * rights cover. Every item has its own icon from the registry (`src/lib/icons.ts`).
 */
export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: EntityIcon.dashboard, section: 'overview', capability: 'canViewOperations', description: 'Key figures of the selected plant' },
  { name: 'Reports', href: '/reports', icon: EntityIcon.report, section: 'overview', capability: 'canViewAnalysis', description: 'OEE, loss, downtime and reconciliation reports' },
  { name: 'Event Hub', href: '/events', icon: EntityIcon.event, section: 'production', capability: 'canViewOperations', description: 'Stops and production events' },
  {
    name: 'Downtime Analysis',
    href: '/downtime',
    icon: EntityIcon.downtime,
    section: 'production',
    capability: 'canViewOperations',
    description: 'What is down, why, how often and where',
  },
  { name: 'Production Loss Analysis', href: '/pla-analytics', icon: EntityIcon.lossAnalysis, section: 'production', capability: 'canViewOperations', description: 'Where production is lost and why' },
  {
    name: 'Plans, Profiles & Calendars',
    href: '/planning',
    icon: EntityIcon.planning,
    section: 'production',
    capability: 'canViewAnalysis',
    description: 'Production plans and their period accounting, profiles, rates and calendars',
    activeAlso: ['/plans/'],
  },
  {
    name: 'My Queue',
    href: '/my-queue',
    icon: EntityIcon.plan,
    section: 'production',
    // a read screen: the server lists only what the caller's roles can act on (empty for read-only roles)
    capability: 'canViewAnalysis',
    description: 'Periods to prepare, review or handle as an escalation, earliest due first',
  },
  {
    name: 'Month Close',
    href: '/month-close',
    icon: EntityIcon.calendar,
    section: 'production',
    capability: 'canViewAnalysis',
    description: 'Close the plant month: approvals, quantity close, finance sign-off and lock',
  },
  {
    // SME E4: every analysis role reads; production / integration / accounting record, accounting approves
    name: 'Measurement Uncertainty',
    href: '/measurement-uncertainty',
    icon: EntityIcon.signal,
    section: 'production',
    capability: 'canViewAnalysis',
    description: 'Uncertainty budgets per measurement boundary that justify the reconciliation tolerance',
  },
  { name: 'RCA Analysis', href: '/rca', icon: EntityIcon.rcaCase, section: 'reliability', capability: 'canViewAnalysis', description: 'Root cause investigations' },
  { name: 'Bad Actors', href: '/reliability/bad-actors', icon: EntityIcon.badActor, section: 'reliability', capability: 'canViewAnalysis', description: 'Monthly top assets and failure modes by approved loss' },
  { name: 'Knowledge Base', href: '/rca-knowledge-base', icon: EntityIcon.knowledge, section: 'reliability', capability: 'canViewAnalysis', description: 'Closed investigations and lessons learned' },
  { name: 'Tasks', href: '/tasks', icon: EntityIcon.task, section: 'reliability', capability: 'canViewOperations', description: 'Assign and track action items' },
  { name: 'Connectivity', href: '/connectivity', icon: EntityIcon.connection, section: 'integration', capability: 'canUseIntegrationConsole', description: 'Connections, ingestion jobs and mappings' },
  // SME R13: drafted by integration admins / production accounting, approved by the source owner; every member reads
  { name: 'Source Status Rules', href: '/connectivity/source-status', icon: EntityIcon.rule, section: 'integration', capability: 'canViewAnalysis', description: 'Which source statuses count as the released record, per source system' },
  // listed for integration roles; the page reads signals and their samples, which every plant member may read
  { name: 'Enhanced Historian', href: '/enhanced-historian', icon: EntityIcon.historian, section: 'integration', capability: 'canViewAnalysis', description: 'Time series of plant signals' },
  { name: 'Master Data', href: '/master-data', icon: EntityIcon.masterData, section: 'administration', capability: 'canReachMasterData', description: 'Plant hierarchy, units, assets, products and reliability plant data' },
  {
    name: 'Codes & Rules',
    href: '/codes-admin',
    icon: EntityIcon.code,
    section: 'administration',
    capability: 'canViewAnalysis',
    description: 'Code libraries and status rules',
  },
  {
    name: 'Finance',
    href: '/finance',
    icon: EntityIcon.finance,
    section: 'administration',
    capability: 'canViewAnalysis',
    description: 'Valuation policy and exchange rates',
  },
  { name: 'User Management', href: '/users', icon: EntityIcon.team, section: 'administration', capability: 'canAdministerTenant', description: 'Users and their access' },
  { name: 'Permissions', href: '/permissions', icon: EntityIcon.permission, section: 'administration', capability: 'canAdministerTenant', description: 'Roles and permissions' },
  // SME R1 / R6: administrators record delegations for anyone, approval-role holders for themselves
  { name: 'Delegations', href: '/delegations', icon: EntityIcon.delegation, section: 'administration', capability: 'canDelegateApprovals', description: 'Approval roles handed to a delegate for an absence' },
  // the page's gate: TenantAdmin gets the plant-level tabs, the application-wide ones stay SuperAdmin-only
  { name: 'Admin Panel', href: '/admin', icon: EntityIcon.admin, section: 'administration', capability: 'canUseAdminPanel', description: 'Administration tools' },
  { name: 'Audit Logs', href: '/audit', icon: EntityIcon.audit, section: 'administration', capability: 'canViewAuditLogs', description: 'Who changed what, and when' },
  // the server's tenant-setting write rule (TenantAdmin / manager_approver in the plant, SuperAdmin)
  { name: 'Settings', href: '/settings', icon: EntityIcon.settings, section: 'administration', capability: 'canManagePlantSettings', description: 'Plant settings: calendar and number display' },
  ...DEV_ITEMS,
];

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
 * Whether `pathname` belongs to the item: the path itself or a sub-path (`/rca/cases/1` is RCA, but
 * `/rca-knowledge-base` is not), plus the item's `activeAlso` prefixes.
 */
export function isNavItemActive(item: Pick<NavigationItem, 'href' | 'activeAlso'>, pathname: string): boolean {
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
  return (item.activeAlso ?? []).some((prefix) => pathname.startsWith(prefix));
}

/** The flags the menu depends on (every `flag` named by an item). */
export const NAVIGATION_FLAGS: readonly FeatureFlagKey[] = [
  ...new Set(NAVIGATION_ITEMS.flatMap((item) => (item.flag ? [item.flag] : []))),
];
