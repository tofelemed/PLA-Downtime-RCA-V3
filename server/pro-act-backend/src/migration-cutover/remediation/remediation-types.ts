import { EntityManager } from 'typeorm';

/** A column value as stored in the audit trail (timestamps as Postgres text, numbers as text). */
export type ChangeValue = string | number | boolean | null;
export type ChangeValues = Record<string, ChangeValue>;

/** Tables a run may change and the columns it may write — nothing else is ever touched. */
export const MUTABLE_COLUMNS = {
  production_events: [
    'end_time',
    'legacy_end_sentinel',
    'physical_state',
    'tenant_id',
  ],
  production_plans: ['tenant_id'],
  feature_flags: ['tenant_id', 'key', 'enabled', 'row_version', 'updated_by'],
  legacy_write_freezes: [
    'tenant_id',
    'reason',
    'frozen_by',
    'frozen_at',
    'released_at',
    'released_by',
  ],
  migration_explanations: [
    'tenant_id',
    'metric',
    'scope_key',
    'legacy_value',
    'v2_value',
    'category',
    'note',
    'author',
  ],
} as const satisfies Record<string, readonly string[]>;

export type MutableTable = keyof typeof MUTABLE_COLUMNS;

/**
 * One row change: `update` guards on `before` (the row must still hold it) and records `after`;
 * `insert` creates the row with `after` (its `id` is `rowId`), and a revert deletes it again.
 */
export interface RowChange {
  kind: 'update' | 'insert';
  table: MutableTable;
  rowId: string;
  before: ChangeValues | null;
  after: ChangeValues;
}

export interface ReviewItemDraft {
  tenantId: string | null;
  legacyTable: string;
  legacyId: string;
  issue: string;
  details: Record<string, unknown>;
}

export interface CrosswalkDraft {
  tenantId: string | null;
  legacyTable: string;
  legacyId: string;
  newTable: string;
  newId: string;
  relation: string;
}

export interface LegacyValueDraft {
  tenantId: string;
  legacyTable: string;
  legacyId: string;
  planId: string | null;
  periodLabel: string | null;
  metric: string;
  /** numeric as text, exactly as read */
  value: string;
}

/** What a job would do: counts for the report plus the rows it would write. */
export interface RemediationPlan {
  findings: Record<string, number>;
  changes: RowChange[];
  reviews: ReviewItemDraft[];
  crosswalk: CrosswalkDraft[];
  legacyValues: LegacyValueDraft[];
}

/** null = every tenant */
export interface JobScope {
  tenantId: string | null;
}

/** A remediation job or cutover operation: computes its plan; the runner dry-runs or applies it. */
export interface PlanSource {
  name: string;
  summary: string;
  plan(manager: EntityManager, scope: JobScope): Promise<RemediationPlan>;
}

export function emptyPlan(): RemediationPlan {
  return {
    findings: {},
    changes: [],
    reviews: [],
    crosswalk: [],
    legacyValues: [],
  };
}

/** Counts per review issue, used in findings and reports. */
export function countBy<T>(
  items: readonly T[],
  key: (item: T) => string,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
  return counts;
}

/** `$n::uuid IS NULL OR <column> = $n` — every job query takes the tenant scope as its first parameter. */
export function tenantFilter(column: string, param = 1): string {
  return `($${param}::uuid IS NULL OR ${column} = $${param}::uuid)`;
}

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
