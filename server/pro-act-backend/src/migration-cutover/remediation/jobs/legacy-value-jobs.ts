import { EntityManager } from 'typeorm';
import {
  countBy,
  emptyPlan,
  JobScope,
  LegacyValueDraft,
  PlanSource,
  RemediationPlan,
  tenantFilter,
  UUID_PATTERN,
} from '../remediation-types';

/**
 * Client-entered v1 values, one row per legacy row and metric (non-null values only). The tenant of an
 * OEE summary without one is its plan's tenant when that is a valid tenant; otherwise the row is skipped
 * here and reported by the `references` job.
 */
const LEGACY_VALUE_ROWS = `
  SELECT 'production_losses' AS "legacyTable", l."id"::text AS "legacyId", l."tenant_id"::text AS "tenantId",
         l."plan_id"::text AS "planId", l."period" AS "periodLabel", v."metric", v."value"
    FROM "production_losses" l
   CROSS JOIN LATERAL (VALUES ('actual', l."actual"::text), ('short_range_plan', l."short_range_plan"::text),
         ('losses', l."losses"::text), ('unaccounted_loss', l."unaccounted_loss"::text),
         ('quantity', l."quantity"::text), ('cost', l."cost"::text)) AS v("metric", "value")
   WHERE v."value" IS NOT NULL AND ${tenantFilter('l."tenant_id"')}
  UNION ALL
  SELECT 'reconcile_forms', f."id"::text, f."tenantId"::text, l."plan_id"::text, l."period", v."metric", v."value"
    FROM "reconcile_forms" f JOIN "production_losses" l ON l."id" = f."lossId"
   CROSS JOIN LATERAL (VALUES ('total_loss_amount', f."totalLossAmount"::numeric::text),
         ('categorized_loss_amount', f."categorizedLossAmount"::numeric::text),
         ('unaccounted_loss_amount', f."unaccountedLossAmount"::numeric::text)) AS v("metric", "value")
   WHERE v."value" IS NOT NULL AND ${tenantFilter('f."tenantId"')}
  UNION ALL
  SELECT 'loss_categories', c."id"::text, c."tenantId"::text, l."plan_id"::text, l."period", 'loss_amount',
         c."lossAmount"::numeric::text
    FROM "loss_categories" c JOIN "reconcile_forms" f ON f."id" = c."reconcileFormId"
    JOIN "production_losses" l ON l."id" = f."lossId"
   WHERE ${tenantFilter('c."tenantId"')}
  UNION ALL
  SELECT 'oee_summaries', o."id"::text, coalesce(o."tenant_id", t."id")::text, o."plan_id"::text, o."period",
         v."metric", v."value"
    FROM "oee_summaries" o JOIN "production_plans" p ON p."id" = o."plan_id"
    LEFT JOIN "tenants" t ON t."id"::text = p."tenant_id"
   CROSS JOIN LATERAL (VALUES ('availability', o."availability"::text), ('performance', o."performance"::text),
         ('quality', o."quality"::text), ('oee', o."oee"::text),
         ('planned_production_time', o."planned_production_time"::text),
         ('actual_production_time', o."actual_production_time"::text), ('downtime', o."downtime"::text))
         AS v("metric", "value")
   WHERE v."value" IS NOT NULL AND coalesce(o."tenant_id", t."id") IS NOT NULL
     AND ${tenantFilter('coalesce(o."tenant_id", t."id")')}`;

/**
 * §18.2 client-entered loss / OEE: every value typed into the v1 Plan Dashboard (production losses,
 * reconcile forms, loss categories, OEE summaries) is copied into `legacy_reported_values` with
 * `method = 'UnknownLegacy'`. Nothing is recalculated, approved or turned into loss lines; the legacy
 * rows stay as they are.
 */
export const legacyValuesJob: PlanSource = {
  name: 'legacy-values',
  summary:
    'client-entered v1 losses / reconcile amounts / OEE → legacy_reported_values (UnknownLegacy)',
  async plan(
    manager: EntityManager,
    scope: JobScope,
  ): Promise<RemediationPlan> {
    const rows: LegacyValueDraft[] = await manager.query(LEGACY_VALUE_ROWS, [
      scope.tenantId,
    ]);
    const plan = emptyPlan();
    plan.legacyValues = rows;
    plan.findings = {
      values: rows.length,
      ...countBy(rows, (row) => `values of ${row.legacyTable}`),
    };
    return plan;
  },
};

/** Event ids a v1 reconcile form names: a single id, a comma / space list or a JSON array. */
export function legacyEventTokens(raw: string | null): string[] {
  const text = (raw ?? '').trim();
  if (text === '') return [];
  if (text.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (Array.isArray(parsed))
        return parsed.map((item) => String(item).trim());
    } catch {
      return [text];
    }
  }
  return text.split(/[\s,;]+/).filter((token) => token.length > 0);
}

interface FormRow {
  id: string;
  tenant: string;
  raw: string;
}

async function existingEvents(
  manager: EntityManager,
  ids: string[],
): Promise<Map<string, string | null>> {
  if (ids.length === 0) return new Map();
  const rows: Array<{ id: string; tenant: string | null }> =
    await manager.query(
      `SELECT "id"::text, "tenant_uuid"::text AS "tenant" FROM "production_events" WHERE "id" = ANY($1::uuid[])`,
      [ids],
    );
  return new Map(rows.map((row) => [row.id, row.tenant]));
}

function linkForm(
  form: FormRow,
  events: Map<string, string | null>,
  plan: RemediationPlan,
): void {
  const tokens = legacyEventTokens(form.raw);
  const valid = tokens.filter(
    (t) => UUID_PATTERN.test(t) && events.get(t.toLowerCase()) === form.tenant,
  );
  for (const eventId of valid) {
    plan.crosswalk.push({
      tenantId: form.tenant,
      legacyTable: 'reconcile_forms',
      legacyId: form.id,
      newTable: 'production_events',
      newId: eventId.toLowerCase(),
      relation: 'explains_event',
    });
  }
  const unresolved = tokens.filter((t) => !valid.includes(t));
  if (unresolved.length === 0 && valid.length > 0) return;
  plan.reviews.push({
    tenantId: form.tenant,
    legacyTable: 'reconcile_forms',
    legacyId: form.id,
    issue: valid.length > 0 ? 'LINK_PARTIAL' : 'LINK_UNRESOLVED',
    details: {
      productionEvent: form.raw,
      unresolved,
      provenance: 'reconcile_forms.productionEvent',
    },
  });
}

/**
 * §18.2 missing event ↔ loss links: a link is reconstructed only from an explicit event id in
 * `reconcile_forms.productionEvent` that exists in the same tenant (crosswalk `explains_event`); text,
 * unknown ids and ids of another tenant stay unlinked with their provenance (review).
 */
export const linksJob: PlanSource = {
  name: 'links',
  summary:
    'reconcile_forms.productionEvent → event crosswalk when it is a valid id, else review',
  async plan(
    manager: EntityManager,
    scope: JobScope,
  ): Promise<RemediationPlan> {
    const forms: FormRow[] = await manager.query(
      `SELECT "id"::text, "tenantId"::text AS "tenant", "productionEvent" AS "raw"
         FROM "reconcile_forms" WHERE ${tenantFilter('"tenantId"')}`,
      [scope.tenantId],
    );
    const ids = forms
      .flatMap((form) => legacyEventTokens(form.raw))
      .filter((token) => UUID_PATTERN.test(token))
      .map((token) => token.toLowerCase());
    const events = await existingEvents(manager, [...new Set(ids)]);
    const plan = emptyPlan();
    for (const form of forms) linkForm(form, events, plan);
    plan.findings = {
      forms: forms.length,
      linked: plan.crosswalk.length,
      ...countBy(plan.reviews, (r) => r.issue),
    };
    return plan;
  },
};
