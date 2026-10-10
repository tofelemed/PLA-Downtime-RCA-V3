import { EntityManager } from 'typeorm';
import {
  countBy,
  emptyPlan,
  JobScope,
  PlanSource,
  RemediationPlan,
  tenantFilter,
} from '../remediation-types';
import { parseLegacyPeriodLabel, ParsedPeriodLabel } from './period-label';

interface LabelRow {
  legacyTable: 'production_losses' | 'oee_summaries';
  id: string;
  tenant: string | null;
  label: string | null;
  unitId: string | null;
}

interface PeriodRow {
  id: string;
  unitId: string;
  key: string;
}

const LABEL_ROWS = `
  SELECT 'production_losses' AS "legacyTable", l."id", l."tenant_id"::text AS "tenant", l."period" AS "label",
         p."unit_ref_id"::text AS "unitId"
    FROM "production_losses" l JOIN "production_plans" p ON p."id" = l."plan_id"
   WHERE ${tenantFilter('l."tenant_id"')}
  UNION ALL
  SELECT 'oee_summaries', o."id", o."tenant_id"::text, o."period", p."unit_ref_id"::text
    FROM "oee_summaries" o JOIN "production_plans" p ON p."id" = o."plan_id"
   WHERE ${tenantFilter('o."tenant_id"')}`;

async function periodsByDay(
  manager: EntityManager,
  pairs: Array<{ unitId: string; localDate: string }>,
): Promise<Map<string, string[]>> {
  const found = new Map<string, string[]>();
  if (pairs.length === 0) return found;
  const rows: PeriodRow[] = await manager.query(
    `SELECT pp."id", pp."unit_id"::text AS "unitId", pp."unit_id"::text || '|' || pp."local_date"::text AS "key"
       FROM "production_periods" pp
       JOIN unnest($1::uuid[], $2::date[]) AS k("unit_id", "local_date")
         ON k."unit_id" = pp."unit_id" AND k."local_date" = pp."local_date"
      ORDER BY pp."utc_start"`,
    [pairs.map((p) => p.unitId), pairs.map((p) => p.localDate)],
  );
  for (const row of rows)
    found.set(row.key, [...(found.get(row.key) ?? []), row.id]);
  return found;
}

async function periodAt(
  manager: EntityManager,
  unitId: string,
  at: string,
): Promise<string[]> {
  const rows: Array<{ id: string }> = await manager.query(
    `SELECT "id" FROM "production_periods" WHERE "unit_id" = $1 AND "utc_start" <= $2 AND "utc_end" > $2`,
    [unitId, at],
  );
  return rows.map((row) => row.id);
}

function review(
  plan: RemediationPlan,
  row: LabelRow,
  issue: string,
  details: Record<string, unknown>,
): void {
  plan.reviews.push({
    tenantId: row.tenant,
    legacyTable: row.legacyTable,
    legacyId: row.id,
    issue,
    details: { label: row.label, ...details },
  });
}

async function candidates(
  manager: EntityManager,
  row: LabelRow & { unitId: string },
  parsed: ParsedPeriodLabel,
  byDay: Map<string, string[]>,
): Promise<string[]> {
  if (parsed.kind === 'day')
    return byDay.get(`${row.unitId}|${parsed.localDate}`) ?? [];
  if (parsed.kind === 'instant')
    return periodAt(manager, row.unitId, parsed.at);
  return [];
}

interface LabelContext {
  manager: EntityManager;
  plan: RemediationPlan;
  byDay: Map<string, string[]>;
}

/** One legacy label → crosswalk rows to its candidate periods, or a review item. */
async function planLabel(
  context: LabelContext,
  row: LabelRow,
  p: ParsedPeriodLabel,
): Promise<void> {
  const { manager, plan, byDay } = context;
  if (p.kind === 'ambiguous') {
    review(plan, row, 'PERIOD_AMBIGUOUS', { reason: p.reason });
    return;
  }
  if (!row.unitId) {
    review(plan, row, 'PERIOD_NO_UNIT', {});
    return;
  }
  const ids = await candidates(
    manager,
    { ...row, unitId: row.unitId },
    p,
    byDay,
  );
  if (ids.length === 0) {
    review(plan, row, 'PERIOD_NO_CANDIDATE', { parsed: p });
    return;
  }
  for (const id of ids) {
    plan.crosswalk.push({
      tenantId: row.tenant,
      legacyTable: row.legacyTable,
      legacyId: row.id,
      newTable: 'production_periods',
      newId: id,
      relation: p.kind === 'day' ? 'period_day' : 'period_instant',
    });
  }
}

/**
 * §18.2 free-text periods: each `production_losses.period` / `oee_summaries.period` label is parsed with
 * its plan's unit; a plant-local day maps to that day's generated periods (crosswalk `period_day`, one
 * row per shift period), an ISO instant to the period containing it (`period_instant`). Ambiguous
 * labels, plans without a unit and days without generated periods go to review. No period is created.
 */
export const periodsJob: PlanSource = {
  name: 'periods',
  summary:
    'free-text v1 periods → candidate production periods (crosswalk), ambiguous → review',
  async plan(
    manager: EntityManager,
    scope: JobScope,
  ): Promise<RemediationPlan> {
    const rows: LabelRow[] = await manager.query(LABEL_ROWS, [scope.tenantId]);
    const parsed = rows.map((row) => parseLegacyPeriodLabel(row.label));
    const days = rows.flatMap((row, i) => {
      const p = parsed[i];
      return row.unitId && p.kind === 'day'
        ? [{ unitId: row.unitId, localDate: p.localDate }]
        : [];
    });
    const byDay = await periodsByDay(manager, days);
    const plan = emptyPlan();
    const context = { manager, plan, byDay };
    for (const [i, row] of rows.entries())
      await planLabel(context, row, parsed[i]);
    plan.findings = {
      labels: rows.length,
      ...countBy(plan.reviews, (r) => r.issue),
    };
    return plan;
  },
};
