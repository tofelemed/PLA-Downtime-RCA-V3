import { ceilToMinute, floorToMinute } from './time-window';

/**
 * Query key factory of the v2 cache (plan 3.1, UX02). Every key starts with `['v2', tenantId, resource]`
 * so a tenant switch, a realtime notice or a mutation can invalidate exactly one tenant's resource; list
 * keys add scope, window, filters, ledger and revision selector in a fixed order. The window is keyed
 * minute-stable and without the display timezone (never sent to the server), so revisits hit the cache.
 */
export type V2Resource =
  | 'production-events'
  | 'production-periods'
  | 'period-accounting'
  | 'reports'
  | 'codes'
  | 'plans'
  | 'profiles'
  | 'products'
  | 'calendars'
  | 'crews'
  | 'sites'
  | 'units'
  | 'shift-instances'
  | 'feature-flags'
  | 'jobs'
  | 'connections'
  | 'ingestion-jobs'
  | 'ingestion-exceptions'
  | 'replay-runs'
  | 'source-mappings'
  | 'attribute-mappings'
  | 'signals'
  | 'code-mapping-rules'
  | 'rules'
  | 'rca-cases'
  | 'rca-recommendations'
  | 'rca-knowledge'
  | 'valuation'
  | 'users'
  | 'user-scopes'
  | 'tasks'
  | 'audit-logs'
  | 'admin-config'
  | 'assets'
  | 'rca-settings'
  | 'master-data'
  | 'reliability'
  | 'close'
  | 'status-mappings'
  | 'uncertainty-budgets'
  | 'notifications';

export interface V2Window {
  from?: string;
  to?: string;
  /** IANA zone the window was chosen in (display only; left out of the key — the window itself is UTC) */
  tz?: string;
}

export interface V2ListParts {
  scope?: { unitIds?: readonly string[] } | null;
  window?: V2Window | null;
  filters?: Record<string, unknown>;
  ledger?: string | null;
  revisionSelector?: string | null;
}

/** Index of the window inside a list key (used by the overlap invalidation). */
export const WINDOW_KEY_INDEX = 5;

const sortedUnits = (scope: V2ListParts['scope']) =>
  scope?.unitIds ? { unitIds: [...scope.unitIds].sort() } : null;

/** The key form of a window: UTC bounds widened to whole minutes, no display timezone. */
export function stableWindow(window: V2Window | null | undefined): V2Window | null {
  if (!window) return null;
  return { from: floorToMinute(window.from), to: ceilToMinute(window.to) };
}

export const v2Keys = {
  all: (tenantId: string) => ['v2', tenantId] as const,
  resource: (tenantId: string, resource: V2Resource) => ['v2', tenantId, resource] as const,
  list: (tenantId: string, resource: V2Resource, parts: V2ListParts = {}) =>
    [
      'v2',
      tenantId,
      resource,
      'list',
      sortedUnits(parts.scope),
      stableWindow(parts.window),
      parts.filters ?? {},
      parts.ledger ?? null,
      parts.revisionSelector ?? null,
    ] as const,
  detail: (tenantId: string, resource: V2Resource, id: string, variant?: string) =>
    ['v2', tenantId, resource, 'detail', id, variant ?? null] as const,
};
