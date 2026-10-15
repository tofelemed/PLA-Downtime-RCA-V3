import { HOUR } from './support/actuals-world';
import { plus } from './support/accounting-world';
import { ReconciliationWorld } from './support/reconciliation-world';

interface Envelope<T> {
  data: T;
  isProvisional: boolean;
}

interface StatusBody {
  periods: number;
  workflow: Array<{ state: string; periods: number }>;
  residual: Array<{ state: string; periods: number }>;
  ages: Array<{ key: string; periods: number }>;
  overdueCount: number;
  escalated: Array<{ level: number; role: string; periods: number }>;
  overdue: Array<{ periodId: string; workflowState: string }>;
}

/** 1,600 one-hour periods on unit A1 from this instant (a fixed 2027 test day, clear of the 2.8 world's day). */
const START = '2027-06-01T00:00:00Z';
const PERIODS = 1600;

/** Revisions by period index: [first, last) → lifecycle, stale flag, extra cancelled revision on top. */
const REVISIONS = [
  { from: 0, to: 100, lifecycle: 'draft', stale: false, cancelled: false },
  { from: 100, to: 150, lifecycle: 'in_review', stale: true, cancelled: false },
  {
    from: 150,
    to: 170,
    lifecycle: 'in_review',
    stale: false,
    cancelled: false,
  },
  { from: 170, to: 200, lifecycle: 'approved', stale: false, cancelled: false },
  { from: 200, to: 210, lifecycle: 'approved', stale: false, cancelled: true },
];

/**
 * Reconciliation analytics of a scope above the old 1,500-period cap (manager-6 AN03 regression): the
 * reports answer 200 — status counts from one SQL aggregation, the other reports read in keyset pages —
 * instead of 422 TOO_MANY_PERIODS. Periods and revisions are seeded in two set-based SQL statements.
 */
describe('PLA analytics over more than 1,500 periods (no period cap)', () => {
  const env = new ReconciliationWorld();
  const window = `from=${encodeURIComponent(START)}&to=${encodeURIComponent(plus(START, PERIODS * HOUR))}`;
  let scope = '';
  let firstPeriod = '';

  const read = async <T>(path: string) =>
    (await env.get(`reports/${path}`).expect(200)).body as Envelope<T>;

  beforeAll(async () => {
    await env.start();
    const { tenantA, unitA1 } = env.world;
    scope = `unitIds=${unitA1}&${window}`;
    await env.rows(
      `INSERT INTO "production_periods" ("tenant_id", "row_version", "unit_id", "utc_start", "utc_end", "local_date")
       SELECT $1, 1, $2, $3::timestamptz + make_interval(hours => i), $3::timestamptz + make_interval(hours => i + 1),
              ($3::timestamptz + make_interval(hours => i))::date
         FROM generate_series(0, $4 - 1) AS i`,
      [tenantA, unitA1, START, PERIODS],
    );
    for (const r of REVISIONS) {
      await env.rows(
        `WITH ranked AS (
           SELECT "id", row_number() OVER (ORDER BY "utc_start") - 1 AS "i" FROM "production_periods"
            WHERE "unit_id" = $2 AND "utc_start" >= $3 AND "utc_start" < $3::timestamptz + make_interval(hours => $4))
         INSERT INTO "accounting_revisions" ("tenant_id", "row_version", "period_id", "revision", "lifecycle", "is_stale")
         SELECT $1, 1, "id", rev, CASE WHEN rev = 2 THEN 'cancelled' ELSE $7 END::accounting_revision_lifecycle, $8
           FROM ranked, generate_series(1, CASE WHEN $9 THEN 2 ELSE 1 END) AS rev
          WHERE "i" >= $5 AND "i" < $6`,
        [
          tenantA,
          unitA1,
          START,
          PERIODS,
          r.from,
          r.to,
          r.lifecycle,
          r.stale,
          r.cancelled,
        ],
      );
    }
    const [first] = await env.rows<{ id: string }>(
      `SELECT "id" FROM "production_periods" WHERE "unit_id" = $1 AND "utc_start" = $2`,
      [unitA1, START],
    );
    firstPeriod = first.id;
  });
  afterAll(() => env.stop());

  it('reconciliation status: 200 with workflow, age and overdue counts of all 1,600 periods', async () => {
    const asOf = encodeURIComponent(plus(START, 1000 * HOUR));
    const status = await read<StatusBody>(
      `reconciliation-status?${scope}&asOf=${asOf}`,
    );
    expect(status.data.periods).toBe(PERIODS);
    expect(
      Object.fromEntries(status.data.workflow.map((w) => [w.state, w.periods])),
    ).toEqual({
      none: 1390,
      draft: 100,
      in_review: 20,
      stale: 50,
      approved: 40,
    });
    expect(
      Object.fromEntries(status.data.ages.map((a) => [a.key, a.periods])),
    ).toEqual({
      not_ended: 600,
      lt_24h: 24,
      '24h_72h': 48,
      '72h_7d': 96,
      gt_7d: 792,
    });
    expect(status.data.residual.reduce((n, r) => n + r.periods, 0)).toBe(
      PERIODS,
    );
    expect(
      status.data.residual.find((r) => r.state === 'not_computable')?.periods,
    ).toBe(PERIODS);
    // SME R3 policy: a draft (or never reconciled) period is overdue 12 h after its production day ended, one
    // in review 24 h after: days 0–40 for the 874 not-approved draft / none periods, days 0–39 for the 70 in review
    expect(status.data.overdueCount).toBe(944);
    // 48 h → production accounting (day 38), 72 h → plant management (days 0–37, less the 40 approved)
    expect(status.data.escalated).toEqual([
      { level: 1, role: 'production_accountant', periods: 24 },
      { level: 2, role: 'manager_approver', periods: 872 },
    ]);
    expect(status.data.overdue).toHaveLength(50);
    expect(status.data.overdue[0]).toMatchObject({
      periodId: firstPeriod,
      workflowState: 'draft',
    });
    expect(status.isProvisional).toBe(true);
  });

  it('trend, actuals quality and the scope waterfall read every period in keyset pages', async () => {
    const quality = await read<{
      periods: number;
      periodsWithoutActuals: number;
    }>(`actuals-quality?${scope}`);
    expect(quality.data).toMatchObject({
      periods: PERIODS,
      periodsWithoutActuals: PERIODS,
    });
    const trend = await read<{ buckets: Array<{ excludedSlices: number }> }>(
      `reconciliation-trend?${scope}&groupBy=day`,
    );
    expect(trend.data.buckets.reduce((n, b) => n + b.excludedSlices, 0)).toBe(
      PERIODS,
    );
    const waterfall = await read<{ periodIds: string[]; excluded: unknown[] }>(
      `scope-waterfall?${scope}`,
    );
    expect(new Set(waterfall.data.periodIds).size).toBe(PERIODS);
    expect(waterfall.data.periodIds[0]).toBe(firstPeriod);
    expect(waterfall.data.excluded).toHaveLength(PERIODS);
  });
});
