import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckSquare,
  Code,
  Coins,
  Database,
  FileText,
  Lock,
  Settings,
  Shield,
  TrendingDown,
  UserCog,
  Users,
} from 'lucide-react';
import type { FeatureFlagKey } from '@/api/v2/types/flags';
import type { Capabilities, CapabilityKey } from './capabilities';

export interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
  /** the capability (of the selected plant) that lists the item */
  capability: CapabilityKey;
  description: string;
  /** listed only while the flag is on for the plant */
  flag?: FeatureFlagKey;
}

/**
 * The sidebar, in order. Each entry names the capability that shows it, so a scope role (e.g.
 * `master_data_admin`, `integration_admin`, `viewer`) reaches the same screens its API rights cover.
 */
export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3, capability: 'canViewOperations', description: 'View analytics and quick stats' },
  { name: 'Reports', href: '/reports', icon: BarChart3, capability: 'canViewAnalysis', description: 'OEE, loss, RCA, audit, and task reports' },
  { name: 'Production Loss Analysis', href: '/pla-analytics', icon: BarChart3, capability: 'canViewOperations', description: 'Deep-dive production loss analytics' },
  { name: 'Production Plans', href: '/production-plans', icon: Calendar, capability: 'canViewAnalysis', description: 'Manage and review production plans' },
  {
    name: 'Plans, Profiles & Calendars',
    href: '/planning',
    icon: Calendar,
    capability: 'canViewAnalysis',
    description: 'Versioned plans, production profiles and calendars (v2)',
    flag: 'v2.plansProfilesCalendars',
  },
  { name: 'Event Hub', href: '/events', icon: AlertTriangle, capability: 'canViewOperations', description: 'Monitor and analyze events' },
  {
    name: 'Downtime Analysis',
    href: '/downtime',
    icon: TrendingDown,
    capability: 'canViewOperations',
    description: 'What is down, why, how often and where (v2)',
    // UX01 entry point of the plan 3.3 screen: listed only while its flag is on for the plant
    flag: 'v2.downtimeAnalysis',
  },
  { name: 'RCA Analysis', href: '/rca', icon: FileText, capability: 'canViewAnalysis', description: 'Root Cause Analysis investigations' },
  { name: 'Knowledge Base', href: '/rca-knowledge-base', icon: Database, capability: 'canViewAnalysis', description: 'Closed RCAs & lessons learned' },
  { name: 'Master Data', href: '/master-data', icon: Code, capability: 'canManageMasterData', description: 'Configure master data' },
  {
    name: 'Codes & Rules',
    href: '/codes-admin',
    icon: Code,
    capability: 'canViewAnalysis',
    description: 'Versioned code libraries and declarative rules (v2)',
    flag: 'v2.codesAdmin',
  },
  {
    name: 'Finance',
    href: '/finance',
    icon: Coins,
    capability: 'canViewAnalysis',
    description: 'Valuation policy approval and FX rates (v2)',
    // plan 2.6 finance screens: part of the v2 admin area, listed only while its flag is on
    flag: 'v2.codesAdmin',
  },
  { name: 'User Management', href: '/users', icon: Users, capability: 'canAdministerTenant', description: 'Manage users and access' },
  // the page's gate: TenantAdmin gets the plant-level tabs, the application-wide ones stay SuperAdmin-only
  { name: 'Admin Panel', href: '/admin', icon: UserCog, capability: 'canUseAdminPanel', description: 'Admin tools and settings' },
  { name: 'Permissions', href: '/permissions', icon: Lock, capability: 'canAdministerTenant', description: 'Set permissions and roles' },
  { name: 'Connectivity', href: '/connectivity', icon: Activity, capability: 'canUseIntegrationConsole', description: 'System connectivity status' },
  // same gate as the page (EnhancedHistorian.tsx: canUseIntegrationConsole)
  { name: 'Enhanced Historian', href: '/enhanced-historian', icon: Database, capability: 'canUseIntegrationConsole', description: 'Multi-attribute time series analysis' },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare, capability: 'canViewOperations', description: 'Assign and track action items' },
  { name: 'Audit Logs', href: '/audit', icon: Shield, capability: 'canViewAuditLogs', description: 'View audit logs' },
  { name: 'Settings', href: '/settings', icon: Settings, capability: 'canAdministerTenant', description: 'System settings' },
  // legacy demo seeding: development builds only (plan 3.1 step 7, decision A4)
  ...(import.meta.env.DEV
    ? [{ name: 'Data Seeding', href: '/data-seeding', icon: Database, capability: 'canAdministerTenant' as const, description: 'Manage test data for PLA and RCA' }]
    : []),
];

/** The items the user sees: capability held in the selected plant and, when flagged, the flag on. */
export function visibleNavigationItems(
  capabilities: Capabilities,
  flagsOn: Partial<Record<FeatureFlagKey, boolean>>,
  items: readonly NavigationItem[] = NAVIGATION_ITEMS,
): NavigationItem[] {
  return items.filter((item) => capabilities[item.capability] && (!item.flag || flagsOn[item.flag] === true));
}
