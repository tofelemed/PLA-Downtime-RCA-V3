import { EntityManager } from 'typeorm';
import {
  countBy,
  emptyPlan,
  JobScope,
  PlanSource,
  RemediationPlan,
  tenantFilter,
} from '../remediation-types';

interface OwnedRow {
  id: string;
  tenantText: string | null;
  unitTenant: string | null;
  unitFound: boolean;
}

/** Rows whose own tenant is missing or not a tenant, with the tenant of the unit they reference. */
const EVENTS_WITHOUT_TENANT = `
  SELECT e."id", e."tenant_id" AS "tenantText", ut."id"::text AS "unitTenant", (u."id" IS NOT NULL) AS "unitFound"
    FROM "production_events" e
    LEFT JOIN "units" u ON u."id" = e."unit_id"
    LEFT JOIN "tenants" ut ON ut."id" = u."tenant_id"
   WHERE (e."tenant_id" IS NULL OR NOT EXISTS (SELECT 1 FROM "tenants" t WHERE t."id" = e."tenant_id"))
     AND ($1::uuid IS NULL OR u."tenant_id" = $1::uuid)`;

const PLANS_WITHOUT_TENANT = `
  SELECT p."id", p."tenant_id" AS "tenantText", ut."id"::text AS "unitTenant", (u."id" IS NOT NULL) AS "unitFound"
    FROM "production_plans" p
    LEFT JOIN "units" u ON u."id" = coalesce(p."unit_ref_id",
         CASE WHEN p."unit_id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN p."unit_id"::uuid END)
    LEFT JOIN "tenants" ut ON ut."id" = u."tenant_id"
   WHERE (p."tenant_id" IS NULL OR NOT EXISTS (SELECT 1 FROM "tenants" t WHERE t."id" = p."tenant_id"))
     AND ($1::uuid IS NULL OR u."tenant_id" = $1::uuid)`;

const EVENT_UNIT_MISMATCH = `
  SELECT e."id", e."tenant_id"::text AS "tenant", u."tenant_id"::text AS "unitTenant"
    FROM "production_events" e JOIN "units" u ON u."id" = e."unit_id"
   WHERE e."tenant_id" IS NOT NULL AND u."tenant_id" <> e."tenant_id" AND ${tenantFilter('e."tenant_id"')}`;

/** Other legacy tables with a nullable tenant: reported for review, never written. */
const TENANTLESS: ReadonlyArray<[table: string, sql: string]> = [
  [
    'products',
    `SELECT "id" FROM "products" WHERE ("tenant_id" IS NULL OR NOT EXISTS (SELECT 1 FROM "tenants" t WHERE t."id" = "products"."tenant_id")) AND $1::uuid IS NULL`,
  ],
  [
    'oee_summaries',
    `SELECT "id" FROM "oee_summaries" WHERE "tenant_id" IS NULL AND $1::uuid IS NULL`,
  ],
];

function resolve(
  table: 'production_events' | 'production_plans',
  rows: OwnedRow[],
  plan: RemediationPlan,
): void {
  for (const row of rows) {
    if (row.unitTenant !== null) {
      plan.changes.push({
        kind: 'update',
        table,
        rowId: row.id,
        before: { tenant_id: row.tenantText },
        after: { tenant_id: row.unitTenant },
      });
      continue;
    }
    plan.reviews.push({
      tenantId: null,
      legacyTable: table,
      legacyId: row.id,
      issue: 'TENANT_UNRESOLVED',
      details: {
        tenantId: row.tenantText,
        reason: row.unitFound ? 'unit has no valid tenant' : 'unit not found',
      },
    });
  }
}

async function tenantlessReviews(
  manager: EntityManager,
  scope: JobScope,
  plan: RemediationPlan,
): Promise<void> {
  for (const [table, sql] of TENANTLESS) {
    const rows: Array<{ id: string }> = await manager.query(sql, [
      scope.tenantId,
    ]);
    for (const row of rows) {
      plan.reviews.push({
        tenantId: null,
        legacyTable: table,
        legacyId: row.id,
        issue: 'TENANT_MISSING',
        details: { rule: 'no ownership evidence used automatically' },
      });
    }
  }
}

/**
 * §18.2 missing tenant / invalid references: an event or plan without a valid tenant takes the tenant
 * that owns its unit (ownership evidence); without that evidence it goes to review — a default tenant
 * is never written. Events whose tenant differs from their unit's tenant are conflicting evidence and
 * go to review unchanged; tenant-less products and OEE summaries are reported only.
 */
export const referencesJob: PlanSource = {
  name: 'references',
  summary:
    'missing tenant → owner of the unit; no evidence or conflict → review',
  async plan(
    manager: EntityManager,
    scope: JobScope,
  ): Promise<RemediationPlan> {
    const plan = emptyPlan();
    const params = [scope.tenantId];
    resolve(
      'production_events',
      await manager.query(EVENTS_WITHOUT_TENANT, params),
      plan,
    );
    resolve(
      'production_plans',
      await manager.query(PLANS_WITHOUT_TENANT, params),
      plan,
    );
    const mismatches: Array<{
      id: string;
      tenant: string;
      unitTenant: string;
    }> = await manager.query(EVENT_UNIT_MISMATCH, params);
    for (const row of mismatches) {
      plan.reviews.push({
        tenantId: row.tenant,
        legacyTable: 'production_events',
        legacyId: row.id,
        issue: 'TENANT_UNIT_MISMATCH',
        details: { eventTenant: row.tenant, unitTenant: row.unitTenant },
      });
    }
    await tenantlessReviews(manager, scope, plan);
    plan.findings = {
      resolvedFromUnit: plan.changes.length,
      ...countBy(plan.reviews, (r) => `${r.issue} (${r.legacyTable})`),
    };
    return plan;
  },
};
