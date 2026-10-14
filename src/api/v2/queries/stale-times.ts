import type { V2Resource } from './query-keys';

const MINUTE = 60_000;

/**
 * How long a cached v2 result is fresh, by resource class (plan 3.1): master data 5 min, periods and
 * events 30 s (realtime notices invalidate sooner), reports until invalidated (a notice or a mutation).
 */
export const STALE_TIME: Readonly<Record<V2Resource, number>> = {
  codes: 5 * MINUTE,
  sites: 5 * MINUTE,
  units: 5 * MINUTE,
  'shift-instances': 5 * MINUTE,
  plans: 5 * MINUTE,
  profiles: 5 * MINUTE,
  products: 5 * MINUTE,
  calendars: 5 * MINUTE,
  crews: 5 * MINUTE,
  'feature-flags': MINUTE,
  'production-events': 30_000,
  'production-periods': 30_000,
  'period-accounting': 30_000,
  reports: Number.POSITIVE_INFINITY,
  jobs: 0,
  // integration console (plan 3.7): configuration 30 s, live job state and runs always refetched
  connections: 30_000,
  'ingestion-jobs': 0,
  'ingestion-exceptions': 30_000,
  'replay-runs': 0,
  'source-mappings': 30_000,
  'attribute-mappings': 30_000,
  signals: 30_000,
  // codes and admin rules (plan 3.8): configuration, refreshed by the writes that change it
  'code-mapping-rules': 30_000,
  rules: 30_000,
  // RCA (plan 3.9): cases and links refreshed by their writes; recommendations by RCARecommended notices
  'rca-cases': 30_000,
  'rca-recommendations': 30_000,
  // RCA knowledge base (owner decision 2026-10-12): refreshed by votes, publishing and case closes
  'rca-knowledge': 30_000,
  // finance (FX rates, valuation policy versions): refreshed by their writes
  valuation: 30_000,
  // administration: refreshed by their writes
  users: 30_000,
  'user-scopes': 30_000,
  tasks: 30_000,
  'audit-logs': 30_000,
  'admin-config': 5 * MINUTE,
  // master data (units / assets / products / RCA settings): refreshed by the writes that change them
  assets: 5 * MINUTE,
  'rca-settings': 5 * MINUTE,
  'master-data': 5 * MINUTE,
  reliability: 5 * MINUTE,
};
