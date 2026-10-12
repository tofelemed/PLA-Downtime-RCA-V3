import type { Query, QueryClient } from '@tanstack/react-query';
import { V2Resource, V2Window, v2Keys, WINDOW_KEY_INDEX } from './query-keys';

/** What changed, as a realtime notice or a local mutation describes it. */
export interface ChangeNotice {
  tenantId: string;
  /** outbox aggregate type: production_event, production_period, production_plan … */
  entityType: string;
  entityId?: string;
  /** interval the change touches (UTC); null = unknown, invalidate every window */
  window?: { from: string; to: string | null } | null;
}

/** Resources whose cached results may depend on an entity type (event → events, periods, reports). */
export const RELATED_RESOURCES: Readonly<Record<string, readonly V2Resource[]>> = {
  production_event: ['production-events', 'production-periods', 'period-accounting', 'reports', 'rca-recommendations'],
  production_period: ['production-periods', 'period-accounting', 'reports'],
  production_period_window: ['production-periods', 'period-accounting', 'reports'],
  production_plan: ['plans', 'production-periods', 'period-accounting', 'reports'],
  production_profile: ['profiles', 'production-periods', 'period-accounting', 'reports'],
  rate_import: ['profiles', 'production-periods', 'period-accounting', 'reports'],
  calendar_version: ['calendars', 'shift-instances', 'sites', 'production-periods', 'plans'],
  crew: ['crews', 'shift-instances'],
  export_job: ['jobs'],
  feature_flag: ['feature-flags'],
  integration_connection: ['connections'],
  ingestion_job: ['ingestion-jobs', 'connections'],
  ingestion_exception: ['ingestion-exceptions'],
  replay_run: ['replay-runs', 'ingestion-exceptions', 'production-events'],
  source_mapping: ['source-mappings', 'ingestion-exceptions'],
  attribute_mapping: ['attribute-mappings'],
  signal: ['signals'],
  code: ['codes', 'code-mapping-rules'],
  code_mapping_rule: ['code-mapping-rules', 'codes'],
  rule: ['rules'],
  rca_case: ['rca-cases', 'rca-recommendations', 'production-events', 'rca-knowledge'],
  rca_recommendation: ['rca-recommendations'],
  rca_knowledge: ['rca-knowledge'],
  fx_rate: ['valuation'],
  valuation_policy: ['valuation'],
  user: ['users', 'user-scopes'],
  user_scope: ['user-scopes', 'users'],
  task: ['tasks'],
  admin_config: ['admin-config'],
  unit: ['units', 'assets', 'master-data'],
  asset: ['assets', 'master-data'],
  product: ['products', 'master-data'],
  rca_settings: ['rca-settings', 'master-data'],
};

/** Resources to refresh for an entity type; an unknown type refreshes the whole tenant (safe default). */
export function resourcesFor(entityType: string): readonly V2Resource[] | null {
  return RELATED_RESOURCES[entityType] ?? null;
}

const toMs = (value: string | undefined | null, open: number) => {
  if (!value) return open;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? open : ms;
};

/** Whether a cached list window overlaps the change window (half-open; missing bounds are open). */
export function windowsOverlap(cached: V2Window | null | undefined, change: ChangeNotice['window']): boolean {
  if (!cached || !change) return true;
  const cachedFrom = toMs(cached.from, Number.NEGATIVE_INFINITY);
  const cachedTo = toMs(cached.to, Number.POSITIVE_INFINITY);
  const changeFrom = toMs(change.from, Number.NEGATIVE_INFINITY);
  const changeTo = toMs(change.to, Number.POSITIVE_INFINITY);
  return changeFrom < cachedTo && changeTo > cachedFrom;
}

function overlapPredicate(change: ChangeNotice['window']) {
  return (query: Query) => {
    const key = query.queryKey;
    if (key[3] !== 'list') return true;
    return windowsOverlap(key[WINDOW_KEY_INDEX] as V2Window | null, change);
  };
}

/** A refetch already running for a query is kept, not restarted (a burst of notices → one request). */
const KEEP_RUNNING_FETCH = { cancelRefetch: false } as const;

/** Invalidates the cached results a change can affect, one tenant only; returns the resources touched. */
export async function invalidateForChange(queryClient: QueryClient, notice: ChangeNotice): Promise<readonly V2Resource[] | null> {
  const resources = resourcesFor(notice.entityType);
  if (!resources) {
    await queryClient.invalidateQueries({ queryKey: v2Keys.all(notice.tenantId) }, KEEP_RUNNING_FETCH);
    return null;
  }
  await Promise.all(
    resources.map((resource) =>
      queryClient.invalidateQueries(
        {
          queryKey: v2Keys.resource(notice.tenantId, resource),
          predicate: overlapPredicate(notice.window ?? null),
        },
        KEEP_RUNNING_FETCH,
      ),
    ),
  );
  return resources;
}

/** Snapshot refetch after a gap or reconnect: every v2 query of the tenant. */
export function resyncTenant(queryClient: QueryClient, tenantId: string): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: v2Keys.all(tenantId) }, KEEP_RUNNING_FETCH);
}
