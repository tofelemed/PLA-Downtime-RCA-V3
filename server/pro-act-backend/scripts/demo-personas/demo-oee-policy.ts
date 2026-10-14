/**
 * DEMO DATA ONLY (LA-08): the Demo Plant's monthly plans (demo-showcase `seed-plans.ts`) spread the header
 * target over scheduled capacity and do not deduct the grade transitions the showcase history starts each
 * campaign with (`seed-transitions.ts`). The plant therefore keeps `transitionAllowanceInPlan = loss`: the
 * transition allowance stays a plan-ledger loss line, so the showcase waterfalls close on their seeded
 * events instead of booking the planned transition time as unexplained speed loss.
 *
 * Every `oee_policy` scope of the plant (tenant-wide and unit overrides) whose latest version does not say
 * `loss` gets version n+1 — the same body with `loss`, over the same window, with a "Demo:" note — so no
 * other setting and no other instant changes. A plant without any version gets version 1 of the product
 * default with `loss`, as the first-use seed would write it. Real plants keep the product default (`planned`).
 */
import type { Client } from 'pg';
import { OEE_POLICY_DEFAULT } from '../../src/periods/engine-policy-bodies';
import type { PlantRow, WorldSummary } from './demo-world';

export const DEMO_TRANSITION_POLICY_NOTE =
  'Demo: the showcase plans do not deduct scheduled grade transitions from their targets, so the transition allowance stays a plan-ledger loss (transitionAllowanceInPlan = loss)';

interface LatestVersion {
  scope_key: string;
  unit_id: string | null;
  version: number;
  body: Record<string, unknown>;
  effective_from: Date;
  effective_to: Date | null;
}

const FIRST_USE: Omit<LatestVersion, 'body'> = {
  scope_key: 'tenant',
  unit_id: null,
  version: 0,
  effective_from: new Date('1970-01-01T00:00:00Z'),
  effective_to: null,
};

async function latestVersions(
  client: Client,
  tenantId: string,
): Promise<LatestVersion[]> {
  const result = await client.query<LatestVersion>(
    `SELECT DISTINCT ON ("scope_key") "scope_key", "unit_id", "version", "body", "effective_from", "effective_to"
       FROM "accounting_policies"
      WHERE "tenant_id" = $1 AND "policy_kind" = 'oee_policy'
      ORDER BY "scope_key", "version" DESC`,
    [tenantId],
  );
  const rows = result.rows;
  if (rows.some((row) => row.unit_id === null)) return rows;
  return [...rows, { ...FIRST_USE, body: { ...OEE_POLICY_DEFAULT } }];
}

/** Keeps the Demo Plant on `transitionAllowanceInPlan = loss` (see the file comment). */
export async function ensureDemoTransitionPolicy(
  client: Client,
  plant: PlantRow,
  summary: WorldSummary,
): Promise<void> {
  for (const latest of await latestVersions(client, plant.id)) {
    const label = `oee_policy ${plant.code}/${latest.scope_key} transitionAllowanceInPlan=loss`;
    if (latest.body.transitionAllowanceInPlan === 'loss') {
      summary.kept.push(label);
      continue;
    }
    await client.query(
      `INSERT INTO "accounting_policies" ("tenant_id", "row_version", "policy_kind", "unit_id", "scope_key",
              "version", "body", "effective_from", "effective_to", "approved_at", "notes")
       VALUES ($1, 1, 'oee_policy', $2, $3, $4, $5::jsonb, $6, $7, now(), $8)`,
      [
        plant.id,
        latest.unit_id,
        latest.scope_key,
        latest.version + 1,
        JSON.stringify({ ...latest.body, transitionAllowanceInPlan: 'loss' }),
        latest.effective_from,
        latest.effective_to,
        DEMO_TRANSITION_POLICY_NOTE,
      ],
    );
    summary.created.push(label);
  }
}
