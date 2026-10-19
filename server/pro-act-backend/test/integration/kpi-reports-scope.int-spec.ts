import { randomUUID } from 'crypto';
import { A, B, NEXT_DAY } from './support/actuals-world';
import { AccountingWorld } from './support/accounting-world';
import { ApiError, DAY1 } from './support/plan-world';

interface ReportBody {
  data: { calculationRunIds: string[] };
  scope: { tenantId: string; unitIds: string[] };
}

const REPORTS = ['oee', 'downtime', 'reliability'] as const;

/**
 * Plan 2.7 report read models under the unit scope (WF05) and tenancy: a unit-limited caller that names
 * no unit is restricted to its own units (never a tenant-wide aggregate); naming another unit, another
 * tenant's unit or asset is 422 INVALID_REFERENCE; tenant B sees nothing of tenant A; `tenantId` in the
 * query is 400; reads are side-effect free (no row written or updated in any table).
 */
describe('KPI reports and the unit scope (plan 2.7)', () => {
  const env = new AccountingWorld();
  let unitUser = '';
  let runsA1: string[] = [];
  let runsA3: string[] = [];
  let assetA3 = '';
  const window = `from=${encodeURIComponent(DAY1)}&to=${encodeURIComponent(NEXT_DAY)}`;

  const runsOf = async (unitId: string) =>
    (
      await env.rows<{ id: string }>(
        `SELECT ar.current_run_id AS id FROM accounting_revisions ar JOIN production_periods p ON p.id = ar.period_id
          WHERE p.unit_id = $1 AND ar.current_run_id IS NOT NULL`,
        [unitId],
      )
    ).map((r) => r.id);

  /** count and highest xmin of every table: any insert or update changes it. */
  const writeFingerprint = async () => {
    const tables = await env.rows<{ name: string }>(
      `SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relispartition ORDER BY 1`,
    );
    const parts = tables.map(
      (t) =>
        `SELECT '${t.name}' AS t, count(*)::text || ':' || coalesce(max(xmin::text::bigint), 0)::text AS f FROM "${t.name}"`,
    );
    return env.rows<{ t: string; f: string }>(parts.join(' UNION ALL '));
  };

  beforeAll(async () => {
    await env.start();
    const { unitA1, unitA3 } = env.world;
    await env.approvedPlan(unitA1);
    await env.materialize([unitA1, unitA3], DAY1, NEXT_DAY);
    await env.outputEvent(unitA1, A, B, '100');
    await env.outputEvent(unitA3, A, B, '200');
    await env.settle();
    runsA1 = await runsOf(unitA1);
    runsA3 = await runsOf(unitA3);
    unitUser = await env.unitUser(unitA1, 'viewer');
    assetA3 = randomUUID();
    await env.rows(
      `INSERT INTO assets (id, code, name, unit_id, tenant_id) VALUES ($1, 'A3-1', 'A3 asset', $2, $3)`,
      [assetA3, unitA3, env.world.tenantA],
    );
  });
  afterAll(() => env.stop());

  it('a unit-limited caller without unitIds gets its own units only, for every report', async () => {
    expect(runsA1.length).toBeGreaterThan(0);
    expect(runsA3.length).toBeGreaterThan(0);
    for (const report of REPORTS) {
      const body = (
        await env.get(`reports/${report}?${window}`, unitUser).expect(200)
      ).body as ReportBody;
      expect(body.scope.unitIds).toEqual([env.world.unitA1]);
      expect(body.data.calculationRunIds.sort()).toEqual([...runsA1].sort());
      expect(
        body.data.calculationRunIds.some((id) => runsA3.includes(id)),
      ).toBe(false);
    }
    const all = (await env.get(`reports/oee?${window}`).expect(200))
      .body as ReportBody;
    expect(all.data.calculationRunIds.sort()).toEqual(
      [...runsA1, ...runsA3].sort(),
    );
  });

  it('naming a unit outside the scope or of another tenant is 422 INVALID_REFERENCE', async () => {
    for (const report of REPORTS) {
      const other = await env
        .get(
          `reports/${report}?${window}&unitIds=${env.world.unitA3}`,
          unitUser,
        )
        .expect(422);
      expect((other.body as ApiError).code).toBe('INVALID_REFERENCE');
      const foreign = await env
        .get(`reports/${report}?${window}&unitIds=${env.world.unitB1}`)
        .expect(422);
      expect((foreign.body as ApiError).code).toBe('INVALID_REFERENCE');
    }
  });

  it('asset ids must be assets of the tenant on units of the report (422)', async () => {
    const outside = await env
      .get(`reports/reliability?${window}&assetIds=${assetA3}`, unitUser)
      .expect(422);
    expect((outside.body as ApiError).code).toBe('INVALID_REFERENCE');
    const unknown = await env
      .get(`reports/reliability?${window}&assetIds=${randomUUID()}`)
      .expect(422);
    expect((unknown.body as ApiError).code).toBe('INVALID_REFERENCE');
    await env
      .get(`reports/reliability?${window}&assetIds=${assetA3}`)
      .expect(200);
  });

  it('tenant B sees nothing of tenant A; tenantId in the query is 400; no token is 401', async () => {
    const b = (await env.get(`reports/oee?${window}`, env.adminB).expect(200))
      .body as ReportBody;
    expect(b.scope.tenantId).toBe(env.world.tenantB);
    expect(b.data.calculationRunIds).toEqual([]);
    await env
      .get(`reports/oee?${window}&tenantId=${env.world.tenantA}`)
      .expect(400);
    await env.http().get(`/api/v2/reports/oee?${window}`).expect(401);
  });

  it('validates the window: inverted 422 INVALID_RANGE, more than 400 days 422 WINDOW_TOO_LARGE', async () => {
    const inverted = await env
      .get(
        `reports/oee?from=${encodeURIComponent(NEXT_DAY)}&to=${encodeURIComponent(DAY1)}`,
      )
      .expect(422);
    expect((inverted.body as ApiError).code).toBe('INVALID_RANGE');
    const long = await env
      .get(
        `reports/downtime?from=2025-01-01T00:00:00Z&to=${encodeURIComponent(NEXT_DAY)}`,
      )
      .expect(422);
    expect((long.body as ApiError).code).toBe('WINDOW_TOO_LARGE');
  });

  it('OEE groups say when no approved plan covers their periods (QA re-test N4); product groups do not', async () => {
    type Groups = {
      data: { groups: Array<{ key: string | null; noApprovedPlan?: boolean }> };
    };
    const byUnit = (
      await env.get(`reports/oee?${window}&groupBy=unit`).expect(200)
    ).body as Groups;
    const flag = (unitId: string) =>
      byUnit.data.groups.find((g) => g.key === unitId)?.noApprovedPlan;
    expect(flag(env.world.unitA1)).toBe(false);
    expect(flag(env.world.unitA3)).toBe(true);
    const byProduct = (
      await env.get(`reports/oee?${window}&groupBy=product`).expect(200)
    ).body as Groups;
    expect(
      byProduct.data.groups.every((g) => g.noApprovedPlan === undefined),
    ).toBe(true);
  });

  it('reads are side-effect free: no table changes during the report GETs', async () => {
    const before = await writeFingerprint();
    for (const report of REPORTS) {
      await env.get(`reports/${report}?${window}`).expect(200);
      await env.get(`reports/${report}?${window}`, unitUser).expect(200);
    }
    await env
      .get(`reports/oee?${window}&groupBy=product&policy=reconciled`)
      .expect(200);
    await env
      .get(`reports/downtime?${window}&groupBy=reasonLevel1&metric=frequency`)
      .expect(200);
    expect(await writeFingerprint()).toEqual(before);
  });
});
