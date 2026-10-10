import { randomUUID } from 'crypto';
import { EntityManager } from 'typeorm';
import {
  FEATURE_FLAG_DEFAULTS,
  FeatureFlagKey,
} from '../../feature-flags/feature-flag-keys';
import {
  EXPLANATION_CATEGORIES,
  ExplanationCategory,
} from '../entities/migration-explanation.entity';
import {
  emptyPlan,
  JobScope,
  PlanSource,
  RemediationPlan,
  RowChange,
} from '../remediation/remediation-types';

function requireTenant(scope: JobScope): string {
  if (!scope.tenantId) {
    throw new Error('This cutover operation needs --tenant <uuid>');
  }
  return scope.tenantId;
}

async function assertTenantExists(
  manager: EntityManager,
  tenantId: string,
): Promise<void> {
  const rows: unknown[] = await manager.query(
    `SELECT 1 FROM "tenants" WHERE "id" = $1`,
    [tenantId],
  );
  if (rows.length === 0) throw new Error(`Tenant ${tenantId} does not exist`);
}

/** MIG05 step 1: freeze the tenant's v1 writes (423 from the API until released). */
export function freezeOperation(reason: string, actor: string): PlanSource {
  return {
    name: 'cutover:freeze',
    summary: 'freeze v1 writes of the tenant (423 LEGACY_WRITES_FROZEN)',
    async plan(manager, scope): Promise<RemediationPlan> {
      const tenantId = requireTenant(scope);
      await assertTenantExists(manager, tenantId);
      const plan = emptyPlan();
      const active: unknown[] = await manager.query(
        `SELECT 1 FROM "legacy_write_freezes" WHERE "tenant_id" = $1 AND "released_at" IS NULL`,
        [tenantId],
      );
      plan.findings = { alreadyFrozen: active.length };
      if (active.length > 0) return plan;
      plan.changes.push({
        kind: 'insert',
        table: 'legacy_write_freezes',
        rowId: randomUUID(),
        before: null,
        after: {
          tenant_id: tenantId,
          reason,
          frozen_by: actor,
          frozen_at: new Date().toISOString(),
        },
      });
      return plan;
    },
  };
}

/** Releases the tenant's active freeze (resume after cutover, or rollback). */
export function releaseOperation(actor: string): PlanSource {
  return {
    name: 'cutover:release',
    summary: 'release the v1 write freeze of the tenant',
    async plan(manager, scope): Promise<RemediationPlan> {
      const tenantId = requireTenant(scope);
      const rows: Array<{ id: string }> = await manager.query(
        `SELECT "id"::text FROM "legacy_write_freezes" WHERE "tenant_id" = $1 AND "released_at" IS NULL`,
        [tenantId],
      );
      const plan = emptyPlan();
      plan.findings = { activeFreezes: rows.length };
      plan.changes = rows.map((row) => ({
        kind: 'update',
        table: 'legacy_write_freezes',
        rowId: row.id,
        before: { released_at: null, released_by: null },
        after: { released_at: new Date().toISOString(), released_by: actor },
      }));
      return plan;
    },
  };
}

interface FlagRow {
  id: string;
  key: string;
  enabled: boolean;
}

/** The change bringing one flag to `enabled`, or null when it already is (row or registry default). */
function flagChange(
  tenantId: string,
  key: FeatureFlagKey,
  row: FlagRow | undefined,
  enabled: boolean,
): RowChange | null {
  if (row ? row.enabled === enabled : FEATURE_FLAG_DEFAULTS[key] === enabled)
    return null;
  if (row) {
    return {
      kind: 'update',
      table: 'feature_flags',
      rowId: row.id,
      before: { enabled: row.enabled },
      after: { enabled },
    };
  }
  return {
    kind: 'insert',
    table: 'feature_flags',
    rowId: randomUUID(),
    before: null,
    after: { tenant_id: tenantId, key, enabled, row_version: 1 },
  };
}

/** Switches the given screens' flags for the tenant, in the order given; unchanged flags are skipped. */
export function flagSwitchOperation(
  keys: readonly FeatureFlagKey[],
  enabled: boolean,
): PlanSource {
  return {
    name: enabled ? 'cutover:flags-on' : 'cutover:flags-off',
    summary: `${enabled ? 'enable' : 'disable'} ${keys.join(', ')}`,
    async plan(manager, scope): Promise<RemediationPlan> {
      const tenantId = requireTenant(scope);
      await assertTenantExists(manager, tenantId);
      const rows: FlagRow[] = await manager.query(
        `SELECT "id"::text, "key", "enabled" FROM "feature_flags" WHERE "tenant_id" = $1`,
        [tenantId],
      );
      const byKey = new Map(rows.map((row) => [row.key, row]));
      const plan = emptyPlan();
      plan.changes = keys
        .map((key) => flagChange(tenantId, key, byKey.get(key), enabled))
        .filter((change): change is RowChange => change !== null);
      plan.findings = {
        requested: keys.length,
        alreadyAtTarget: keys.length - plan.changes.length,
      };
      return plan;
    },
  };
}

export interface ExplanationInput {
  metric: string;
  scopeKey: string;
  legacyValue: string | null;
  v2Value: string | null;
  category: string;
  note: string;
  author: string;
}

function isCategory(value: string): value is ExplanationCategory {
  return (EXPLANATION_CATEGORIES as readonly string[]).includes(value);
}

/** MIG04: records why one compared value differs (explains exactly that pair of values). */
export function explanationOperation(input: ExplanationInput): PlanSource {
  if (!isCategory(input.category)) {
    throw new Error(
      `--category must be one of ${EXPLANATION_CATEGORIES.join(', ')}`,
    );
  }
  if (input.note.trim().length < 10)
    throw new Error('--note needs at least 10 characters');
  return {
    name: 'cutover:explain',
    summary: `explain ${input.metric} ${input.scopeKey}`,
    async plan(manager, scope): Promise<RemediationPlan> {
      const tenantId = requireTenant(scope);
      await assertTenantExists(manager, tenantId);
      const plan = emptyPlan();
      plan.changes.push({
        kind: 'insert',
        table: 'migration_explanations',
        rowId: randomUUID(),
        before: null,
        after: {
          tenant_id: tenantId,
          metric: input.metric,
          scope_key: input.scopeKey,
          legacy_value: input.legacyValue,
          v2_value: input.v2Value,
          category: input.category,
          note: input.note.trim(),
          author: input.author,
        },
      });
      return plan;
    },
  };
}
