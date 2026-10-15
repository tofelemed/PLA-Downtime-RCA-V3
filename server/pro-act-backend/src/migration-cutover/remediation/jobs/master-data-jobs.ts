import { EntityManager } from 'typeorm';
import {
  countBy,
  emptyPlan,
  JobScope,
  PlanSource,
  RemediationPlan,
  ReviewItemDraft,
  tenantFilter,
} from '../remediation-types';

interface CountRow {
  [key: string]: number;
}

/**
 * §18.2 unpersisted hierarchy: no approved reason tree file has been supplied (D11 Q3, default "start
 * flat"), so nothing is imported or re-parented here — no parents are invented. The job reports the
 * tree as it is and flags codes without a tenant. Codes created or edited through v1 still have no
 * `code_versions` row (1.3 open item; a baseline is written lazily on the first v2 change) — counted.
 */
export const reasonTreeJob: PlanSource = {
  name: 'reason-tree',
  summary:
    'reason tree as stored (flat unless approved tree supplied); tenant-less codes → review',
  async plan(
    manager: EntityManager,
    scope: JobScope,
  ): Promise<RemediationPlan> {
    const [counts]: CountRow[] = await manager.query(
      `SELECT count(*)::int AS "reasonCodes",
              count(*) FILTER (WHERE "parent_id" IS NOT NULL)::int AS "withParent",
              count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM "code_versions" v
                     WHERE v."library" = 'reason' AND v."code_id" = r."id"))::int AS "withoutVersionBaseline"
         FROM "reason_codes" r WHERE ${tenantFilter('r."tenant_id"')}`,
      [scope.tenantId],
    );
    const tenantless: Array<{ id: string; library: string }> =
      await manager.query(
        `SELECT "id"::text, 'reason_codes' AS "library" FROM "reason_codes" WHERE "tenant_id" IS NULL AND $1::uuid IS NULL
       UNION ALL SELECT "id"::text, 'impact_codes' FROM "impact_codes" WHERE "tenant_id" IS NULL AND $1::uuid IS NULL
       UNION ALL SELECT "id"::text, 'oee_codes' FROM "oee_codes" WHERE "tenant_id" IS NULL AND $1::uuid IS NULL`,
        [scope.tenantId],
      );
    const plan = emptyPlan();
    plan.reviews = tenantless.map((row) => ({
      tenantId: null,
      legacyTable: row.library,
      legacyId: row.id,
      issue: 'CODE_WITHOUT_TENANT',
      details: {
        rule: 'not usable as an event reference (NFR01); assign or retire',
      },
    }));
    plan.findings = {
      ...counts,
      treeFileImported: 0,
      ...countBy(plan.reviews, (r) => r.issue),
    };
    return plan;
  },
};

/**
 * §18.2 ambiguous `standard_rate`: D08 Q3 (cost per unit or production rate?) is unanswered, so the
 * column is not split into valuation / production rates; every product carrying a value is flagged.
 */
export const rateJob: PlanSource = {
  name: 'rates',
  summary: 'products.standard_rate → review until D08 Q3 says what it is',
  async plan(
    manager: EntityManager,
    scope: JobScope,
  ): Promise<RemediationPlan> {
    const rows: Array<{
      id: string;
      tenant: string | null;
      rate: string;
      uom: string | null;
    }> = await manager.query(
      `SELECT p."id"::text, t."id"::text AS "tenant", p."standard_rate"::text AS "rate", p."uom"
           FROM "products" p LEFT JOIN "tenants" t ON t."id" = p."tenant_id"
          WHERE p."standard_rate" IS NOT NULL AND ${tenantFilter('t."id"')}`,
      [scope.tenantId],
    );
    const plan = emptyPlan();
    plan.reviews = rows.map((row) => ({
      tenantId: row.tenant,
      legacyTable: 'products',
      legacyId: row.id,
      issue: 'STANDARD_RATE_AMBIGUOUS',
      details: { standardRate: row.rate, uom: row.uom, decision: 'D08 Q3' },
    }));
    plan.findings = { productsWithStandardRate: rows.length };
    return plan;
  },
};

/** Per-tenant aggregates for event amounts without unit / currency (one review item per tenant). */
const EVENT_UNIT_GAPS = `
  SELECT "tenant_id"::text AS "tenant",
         count(*) FILTER (WHERE "cost" IS NOT NULL)::int AS "costRows",
         count(*) FILTER (WHERE "quantity" IS NOT NULL AND "quantity_uom" IS NULL)::int AS "quantityRows"
    FROM "production_events" WHERE "tenant_id" IS NOT NULL AND ${tenantFilter('"tenant_id"')}
   GROUP BY 1`;

async function eventUnitGaps(
  manager: EntityManager,
  scope: JobScope,
  plan: RemediationPlan,
): Promise<void> {
  const rows: Array<{
    tenant: string;
    costRows: number;
    quantityRows: number;
  }> = await manager.query(EVENT_UNIT_GAPS, [scope.tenantId]);
  for (const row of rows) {
    const base = {
      tenantId: row.tenant,
      legacyTable: 'production_events',
      legacyId: row.tenant,
    };
    if (row.costRows > 0)
      plan.reviews.push({
        ...base,
        issue: 'EVENT_COST_CURRENCY_MISSING',
        details: { rows: row.costRows },
      });
    if (row.quantityRows > 0)
      plan.reviews.push({
        ...base,
        issue: 'EVENT_QUANTITY_UOM_MISSING',
        details: { rows: row.quantityRows },
      });
  }
}

/** Per-row flags: products without a unit, v1 loss costs without a currency. */
async function productAndLossFlags(
  manager: EntityManager,
  scope: JobScope,
): Promise<ReviewItemDraft[]> {
  const products: Array<{ id: string; tenant: string | null }> =
    await manager.query(
      `SELECT p."id"::text, t."id"::text AS "tenant" FROM "products" p
         LEFT JOIN "tenants" t ON t."id" = p."tenant_id"
        WHERE coalesce(trim(p."uom"), '') = '' AND ${tenantFilter('t."id"')}`,
      [scope.tenantId],
    );
  const losses: Array<{ id: string; tenant: string; cost: string }> =
    await manager.query(
      `SELECT "id"::text, "tenant_id"::text AS "tenant", "cost"::text FROM "production_losses"
        WHERE "cost" IS NOT NULL AND ${tenantFilter('"tenant_id"')}`,
      [scope.tenantId],
    );
  return [
    ...products.map((p) => ({
      tenantId: p.tenant,
      legacyTable: 'products',
      legacyId: p.id,
      issue: 'UOM_MISSING',
      details: {},
    })),
    ...losses.map((l) => ({
      tenantId: l.tenant,
      legacyTable: 'production_losses',
      legacyId: l.id,
      issue: 'CURRENCY_UNMAPPED',
      details: { cost: l.cost },
    })),
  ];
}

/**
 * §18.2 flat currency / MT: no uom / currency mapping table exists yet (owner input), so nothing is
 * converted. Products without a unit and v1 loss costs (no currency recorded) are flagged per row;
 * event costs without currency and event quantities without a unit are flagged once per tenant.
 */
export const unitsJob: PlanSource = {
  name: 'units',
  summary: 'amounts without uom / currency → review (no mapping table yet)',
  async plan(
    manager: EntityManager,
    scope: JobScope,
  ): Promise<RemediationPlan> {
    const plan = emptyPlan();
    plan.reviews = await productAndLossFlags(manager, scope);
    await eventUnitGaps(manager, scope, plan);
    plan.findings = countBy(
      plan.reviews,
      (r) => `${r.issue} (${r.legacyTable})`,
    );
    return plan;
  },
};
