import { EntityManager } from 'typeorm';
import {
  countBy,
  CrosswalkDraft,
  LegacyValueDraft,
  RemediationPlan,
  ReviewItemDraft,
} from './remediation-types';

/** chr(31) — the same separator the SQL below uses */
const SEP = String.fromCharCode(31);

const reviewKey = (r: ReviewItemDraft) =>
  [r.legacyTable, r.legacyId, r.issue].join(SEP);
const crossKey = (c: CrosswalkDraft) =>
  [c.legacyTable, c.legacyId, c.newTable, c.newId, c.relation].join(SEP);
const valueKey = (v: LegacyValueDraft) =>
  [v.legacyTable, v.legacyId, v.metric].join(SEP);

function uniqueBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function existingKeys(
  manager: EntityManager,
  sql: string,
  params: unknown[],
): Promise<Set<string>> {
  const rows: Array<{ k: string }> = await manager.query(sql, params);
  return new Set(rows.map((row) => row.k));
}

/** false on a database where the 3.10 migration is not applied yet (report-only runs). */
export async function bookkeepingPresent(
  manager: EntityManager,
): Promise<boolean> {
  const rows: Array<{ present: boolean }> = await manager.query(
    `SELECT to_regclass('public.migration_review') IS NOT NULL AS "present"`,
  );
  return rows[0]?.present === true;
}

async function recordedKeys(
  manager: EntityManager,
  job: string,
  plan: RemediationPlan,
): Promise<{
  reviews: Set<string>;
  crosswalk: Set<string>;
  values: Set<string>;
}> {
  const crossTables = [...new Set(plan.crosswalk.map((c) => c.legacyTable))];
  const valueTables = [...new Set(plan.legacyValues.map((v) => v.legacyTable))];
  return {
    reviews: await existingKeys(
      manager,
      `SELECT concat_ws(chr(31), "legacy_table", "legacy_id", "issue") AS k FROM "migration_review" WHERE "job" = $1`,
      [job],
    ),
    crosswalk: await existingKeys(
      manager,
      `SELECT concat_ws(chr(31), "legacy_table", "legacy_id", "new_table", "new_id"::text, "relation") AS k
         FROM "legacy_id_crosswalk" WHERE "legacy_table" = ANY($1)`,
      [crossTables],
    ),
    values: await existingKeys(
      manager,
      `SELECT concat_ws(chr(31), "legacy_table", "legacy_id"::text, "metric") AS k
         FROM "legacy_reported_values" WHERE "legacy_table" = ANY($1)`,
      [valueTables],
    ),
  };
}

/**
 * Drops what an earlier run already recorded (review items of this job, crosswalk rows, legacy values)
 * and duplicates inside the plan, so a re-run reports and writes only what is new (idempotency). On a
 * database without the bookkeeping tables only the in-plan duplicates are dropped.
 */
export async function filterNew(
  manager: EntityManager,
  job: string,
  plan: RemediationPlan,
): Promise<RemediationPlan> {
  const recorded = (await bookkeepingPresent(manager))
    ? await recordedKeys(manager, job, plan)
    : {
        reviews: new Set<string>(),
        crosswalk: new Set<string>(),
        values: new Set<string>(),
      };
  return {
    findings: plan.findings,
    changes: plan.changes,
    reviews: uniqueBy(plan.reviews, reviewKey).filter(
      (r) => !recorded.reviews.has(reviewKey(r)),
    ),
    crosswalk: uniqueBy(plan.crosswalk, crossKey).filter(
      (c) => !recorded.crosswalk.has(crossKey(c)),
    ),
    legacyValues: uniqueBy(plan.legacyValues, valueKey).filter(
      (v) => !recorded.values.has(valueKey(v)),
    ),
  };
}

/** Counts a run reports (dry run: would write; apply: written). */
export interface RunCounts {
  findings: Record<string, number>;
  changes: Record<string, number>;
  reviews: Record<string, number>;
  crosswalk: Record<string, number>;
  legacyValues: Record<string, number>;
}

export function countPlan(plan: RemediationPlan): RunCounts {
  return {
    findings: plan.findings,
    changes: countBy(plan.changes, (c) => `${c.kind} ${c.table}`),
    reviews: countBy(plan.reviews, (r) => r.issue),
    crosswalk: countBy(plan.crosswalk, (c) => c.relation),
    legacyValues: countBy(plan.legacyValues, (v) => v.legacyTable),
  };
}
