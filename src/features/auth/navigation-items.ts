import { DOWNTIME_PAGES, PLA_PAGES } from '@/features/analysis-navigation/analysis-pages';
import { EntityIcon, type AppIcon } from '@/lib/icons';
import type { FeatureFlagKey } from '@/api/v2/types/flags';
import type { Capabilities, CapabilityKey } from './capabilities';

/** Sidebar sections, in display order (docs/UI_UX_AUDIT.md §1). */
export type NavSectionKey = 'overview' | 'production' | 'downtime' | 'pla' | 'reliability' | 'integration' | 'administration';

export interface NavSection {
  key: NavSectionKey;
  label: string;
  icon: AppIcon;
}

export const NAV_SECTIONS: readonly NavSection[] = [
  { key: 'overview', label: 'Overview', icon: EntityIcon.dashboard },
  { key: 'production', label: 'Production', icon: EntityIcon.plant },
  { key: 'downtime', label: 'Downtime Analysis', icon: EntityIcon.downtime },
  { key: 'pla', label: 'Production Loss Analysis (PLA)', icon: EntityIcon.lossAnalysis },
  { key: 'reliability', label: 'Reliability', icon: EntityIcon.rcaCase },
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
  { name: 'Pending Approvals', href: '/approvals', icon: EntityIcon.approvals, section: 'overview', capability: 'canViewOperations', description: 'Pending records for your approval roles in the selected plant' },
  { name: 'Reports', href: '/reports', icon: EntityIcon.report, section: 'overview', capability: 'canViewAnalysis', description: 'OEE, loss, downtime and reconciliation reports' },
  { name: 'Event Hub', href: '/events', icon: EntityIcon.event, section: 'production', capability: 'canViewOperations', description: 'Stops and production events' },
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
  ...DOWNTIME_PAGES.map((page): NavigationItem => ({ name: page.name, label: page.label, href: page.path, icon: page.icon, section: 'downtime', capability: 'canViewOperations', description: page.description, exact: true })),
  ...PLA_PAGES.map((page): NavigationItem => ({ name: page.name, label: page.label, href: page.path, icon: page.icon, section: 'pla', capability: 'canViewOperations', description: page.description, exact: true })),
  { name: 'RCA Analysis', href: '/rca', icon: EntityIcon.rcaCase, section: 'reliability', capability: 'canViewAnalysis', description: 'Root cause investigations' },
  { name: 'Bad Actors', href: '/reliability/bad-actors', icon: EntityIcon.badActor, section: 'reliability', capability: 'canViewAnalysis', description: 'Monthly top assets and failure modes by approved loss' },
  { name: 'Knowledge Base', href: '/rca-knowledge-base', icon: EntityIcon.knowledge, section: 'reliability', capability: 'canViewAnalysis', description: 'Closed investigations and lessons learned' },
  { name: 'Tasks', href: '/tasks', icon: EntityIcon.task, section: 'reliability', capability: 'canViewOperations', description: 'Assign and track action items' },
  { name: 'Connectivity', href: '/connectivity', icon: EntityIcon.connection, section: 'integration', capability: 'canUseIntegrationConsole', description: 'Connections, ingestion jobs and mappings' },
  // SME R13: drafted by integration admins / production accounting, approved by the source owner; every member reads
  { name: 'Source Status Rules', href: '/connectivity/source-status', icon: EntityIcon.rule, section: 'integration', capability: 'canViewAnalysis', description: 'Which source statuses count as the released record, per source system' },
  // owner 15 Oct 2026: drafted by integration admins / production accounting, approved by production accounting; every member reads
  { name: 'Source Priority', href: '/connectivity/source-authority', icon: EntityIcon.library, section: 'integration', capability: 'canViewAnalysis', description: 'Which measurement source counts for each unit, and the versions waiting for approval' },
  // listed for integration roles; the page reads signals and their samples, which every plant member may read
  { name: 'Enhanced Historian', href: '/enhanced-historian', icon: EntityIcon.historian, section: 'integration', capability: 'canViewAnalysis', description: 'Time series of plant signals' },
  { name: 'Equipment Setup Guide', href: '/equipment-setup', icon: EntityIcon.equipmentSetup, section: 'administration', capability: 'canReachMasterData', description: 'Six phases from equipment records to the first approved period and analysis' },
  { name: 'Master Data', href: '/master-data', icon: EntityIcon.masterData, section: 'administration', capability: 'canReachMasterData', activeAlso: ['/codes-admin'], description: 'Plant records, codes, rules and reliability data' },
  {
    name: 'Finance',
    href: '/finance',
    icon: EntityIcon.finance,
    section: 'administration',
    capability: 'canViewAnalysis',
    description: 'Valuation policy and exchange rates',
  },
  { name: 'User Management', href: '/users', icon: EntityIcon.team, section: 'administration', capability: 'canUseUserManagement', activeAlso: ['/permissions', '/delegations'], description: 'Users, permissions and approval delegations' },
  // SME R1 / R6: administrators record delegations for anyone, approval-role holders for themselves
  // the page's gate: TenantAdmin gets the plant-level tabs, the application-wide ones stay SuperAdmin-only
  { name: 'Admin Panel', href: '/admin', activeAlso: ['/settings'], icon: EntityIcon.admin, section: 'administration', capability: 'canUseAdminPanel', description: 'Plants, branding, custom attributes and plant settings' },
  { name: 'Audit Logs', href: '/audit', icon: EntityIcon.audit, section: 'administration', capability: 'canViewAuditLogs', description: 'Who changed what, and when' },
  // the server's tenant-setting write rule (TenantAdmin / manager_approver in the plant, SuperAdmin)

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
export function isNavItemActive(item: Pick<NavigationItem, 'href' | 'activeAlso' | 'exact'>, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
  return (item.activeAlso ?? []).some((prefix) => pathname.startsWith(prefix));
}

/** The flags the menu depends on (every `flag` named by an item). */
export const NAVIGATION_FLAGS: readonly FeatureFlagKey[] = [
  ...new Set(NAVIGATION_ITEMS.flatMap((item) => (item.flag ? [item.flag] : []))),
];
