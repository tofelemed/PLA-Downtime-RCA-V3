import { Dec } from '../../src/domain/actuals/decimal';
import { AccountingPoliciesService } from '../../src/periods/accounting-policies.service';
import { parseReconciliationTolerance } from '../../src/periods/engine-policy-bodies';
import { policyBodiesInForce } from '../../src/periods/policy-bodies-in-force';
import { A, HOUR, NEXT_DAY } from './support/actuals-world';
import { plus } from './support/accounting-world';
import { ApiError, DAY1 } from './support/plan-world';
import { ReconciliationWorld } from './support/reconciliation-world';

interface Envelope<T> {
  data: T;
  isProvisional: boolean;
  coverage: { ratio: number };
  dataQuality: { missingCount: number };
}

interface Bar {
  key: string;
  kind: string;
  delta: string | null;
  start: string;
  end: string;
}

interface WaterfallBody {
  ledger: string;
  uom: string | null;
  bars: Bar[];
  opening: string | null;
  closing: string | null;
  closes: boolean;
  calculationRunIds: string[];
}

interface LossTreeBody {
  groups: Array<{
    key: string | null;
    label: string | null;
    unit: string | null;
    amount: string | null;
    share: string | null;
    cumulativeShare: string | null;
    status: string;
    reasons: string[];
  }>;
  totals: Array<{
    unit: string | null;
    amount: string | null;
    status: string;
    reasons: string[];
  }>;
  truncated: number;
  calculationRunIds: string[];
}

interface TrendBody {
  buckets: Array<{
    key: string;
    uom: string | null;
    unaccounted: string | null;
    overAccounted: string | null;
    periods: number;
  }>;
}

interface StatusBody {
  periods: number;
  workflow: Array<{ state: string; periods: number }>;
  residual: Array<{ state: string; periods: number }>;
  ages: Array<{ key: string; periods: number }>;
  overdueCount: number;
  overdue: Array<{
    periodId: string;
    unitName: string | null;
    planId: string | null;
    workflowState: string;
    ageSeconds: number;
  }>;
}

interface QualityBody {
  periods: number;
  slices: number;
  periodsWithoutActuals: number;
  qualityStates: Array<{ state: string; slices: number }>;
  coverage: Array<{ key: string; slices: number }>;
  lowestCoverage: string | null;
  quantities: Array<{
    uom: string | null;
    measured: string;
    estimated: string;
  }>;
}

const sumOf = (values: Array<string | null | undefined>) =>
  values.reduce((acc, v) => acc.plus(new Dec(v ?? 0)), new Dec(0));

/**
 * Plan 3.6 PLA analytics reads on real Postgres (the 2.8 world: unit A1, three 1000 t shifts with 850 t each,
 * a 1 h stop coded FEED in shift A and a manual 50 t line): the window waterfall equals the 3.5 waterfall of
 * the same periods and closes on both ledgers; the loss tree sums the run's lines per reason with a Pareto
 * line and equals the capacity waterfall's losses; unvalued metrics are null, never 0; the reconciliation
 * trend adds up to the waterfall's unaccounted bar; status and age use a fixed `asOf`; actuals quality
 * counts the stored results; every read is tenant and unit scoped. Fixed 2027 test days, never today.
 */
describe('PLA analytics reads (plan 3.6)', () => {
  const env = new ReconciliationWorld();
  const window = `from=${encodeURIComponent(DAY1)}&to=${encodeURIComponent(NEXT_DAY)}`;
  let scope = '';
  let reason = '';

  const read = async <T>(path: string, token = env.admin) =>
    (await env.get(`reports/${path}`, token).expect(200)).body as Envelope<T>;

  beforeAll(async () => {
    await env.start();
    scope = `unitIds=${env.world.unitA1}&${window}`;
    reason = await env.reasonCode('FEED');
    await env.lossEvent(env.world.unitA1, plus(A, HOUR), 1, {
      reasonCodeId: reason,
    });
    await env.settle();
    const view = await env.view(env.periodA1);
    await env
      .saveLines(view, [
        { action: 'accept', autoKey: view.candidates[0].autoKey },
        {
          action: 'manual',
          sliceId: view.slices[0].sliceId,
          kind: 'availability',
          quantity: '15',
          missingEvent: true,
          // SME R11: a stop without an event cites its record
          evidenceType: 'log',
          evidenceRef: 'shift log',
          reasonCodeId: reason,
        },
      ])
      .expect(200);
  });
  afterAll(() => env.stop());

  it('scope waterfall: the bars of GET /reports/waterfall for the same periods, closing on both ledgers', async () => {
    const scoped = await read<WaterfallBody>(
      `scope-waterfall?${scope}&ledger=plan`,
    );
    const ids = [env.periodA1, env.periodB1, env.periodC1]
      .map((id) => `periodIds=${id}`)
      .join('&');
    const byIds = (
      await env.get(`reports/waterfall?${ids}&ledger=plan`).expect(200)
    ).body as WaterfallBody;
    expect(scoped.data).toMatchObject({
      opening: '3000',
      closing: '2550',
      closes: true,
      uom: 't',
    });
    expect(scoped.data.bars).toEqual(byIds.bars);
    expect(scoped.isProvisional).toBe(true);
    const capacity = await read<WaterfallBody>(
      `scope-waterfall?${scope}&ledger=capacity`,
    );
    expect(capacity.data.closes).toBe(true);
    expect(capacity.data.closing).toBe('2550');
  });

  it('loss tree by reason: run lines largest first with a Pareto line; capacity totals equal the waterfall losses', async () => {
    const plan = await read<LossTreeBody>(
      `loss-tree?${scope}&groupBy=reason&metric=qty&ledger=plan`,
    );
    const feed = plan.data.groups.find((g) => g.key === reason);
    expect(feed).toMatchObject({
      unit: 't',
      amount: '125',
      status: 'quantity',
    });
    expect(feed?.label).toContain('FEED');
    const last = plan.data.groups[plan.data.groups.length - 1];
    expect(last.cumulativeShare).toBe('1');
    expect(plan.data.totals).toEqual([
      expect.objectContaining({
        unit: 't',
        amount: sumOf(plan.data.groups.map((g) => g.amount)).toFixed(),
      }),
    ]);

    const tree = await read<LossTreeBody>(
      `loss-tree?${scope}&groupBy=kind&ledger=capacity`,
    );
    const waterfall = await read<WaterfallBody>(
      `scope-waterfall?${scope}&ledger=capacity`,
    );
    const losses = waterfall.data.bars.filter((b) =>
      ['schedule_exclusion', 'availability', 'performance', 'quality'].includes(
        b.key,
      ),
    );
    expect(
      new Dec(tree.data.totals[0].amount ?? 'NaN').eq(
        sumOf(losses.map((b) => b.delta)).neg(),
      ),
    ).toBe(true);
    expect(tree.data.calculationRunIds).toEqual(
      [...waterfall.data.calculationRunIds].sort(),
    );
  });

  it('loss tree value metrics without an approved valuation are null with a reason, never 0; limit keeps the largest', async () => {
    const margin = await read<LossTreeBody>(
      `loss-tree?${scope}&groupBy=reason&metric=margin`,
    );
    expect(margin.data.totals.length).toBeGreaterThan(0);
    for (const total of margin.data.totals) {
      expect(total.amount).toBeNull();
      expect(total.status).toBe('unvalued');
      expect(total.reasons.length).toBeGreaterThan(0);
    }
    expect(
      margin.data.groups.every((g) => g.amount === null && g.share === null),
    ).toBe(true);
    const all = await read<LossTreeBody>(`loss-tree?${scope}&groupBy=kind`);
    const top = await read<LossTreeBody>(
      `loss-tree?${scope}&groupBy=kind&limit=1`,
    );
    expect(all.data.groups.length).toBeGreaterThan(0);
    expect(top.data.groups).toEqual(all.data.groups.slice(0, 1));
    expect(top.data.truncated).toBe(all.data.groups.length - 1);
    expect(top.data.totals).toEqual(all.data.totals);
  });

  it('loss tree kinds filter (FE-08): only the chosen loss kinds, totals over them; an unknown kind is 422', async () => {
    const all = await read<LossTreeBody>(`loss-tree?${scope}&groupBy=kind`);
    const stops = await read<LossTreeBody>(
      `loss-tree?${scope}&groupBy=kind&kinds=availability`,
    );
    expect(stops.data.groups.map((g) => g.key)).toEqual(['availability']);
    expect(stops.data.groups[0].amount).toBe(
      all.data.groups.find((g) => g.key === 'availability')?.amount,
    );
    expect(stops.data.totals[0].amount).toBe(stops.data.groups[0].amount);
    await env.get(`reports/loss-tree?${scope}&kinds=gain`).expect(422);
  });

  it('reconciliation trend by shift adds up to the waterfall unaccounted bar; weeks use the ISO key', async () => {
    const trend = await read<TrendBody>(
      `reconciliation-trend?${scope}&groupBy=shift`,
    );
    expect(trend.data.buckets).toHaveLength(3);
    expect(trend.data.buckets.map((b) => b.unaccounted)).toEqual([
      '10',
      '150',
      '150',
    ]);
    const waterfall = await read<WaterfallBody>(
      `scope-waterfall?${scope}&ledger=plan`,
    );
    const unaccounted = waterfall.data.bars.find(
      (b) => b.key === 'unaccounted',
    );
    expect(
      sumOf(trend.data.buckets.map((b) => b.unaccounted)).eq(
        new Dec(unaccounted?.delta ?? '0').neg(),
      ),
    ).toBe(true);
    const weeks = await read<TrendBody>(
      `reconciliation-trend?${scope}&groupBy=week`,
    );
    expect(weeks.data.buckets).toEqual([
      expect.objectContaining({
        key: '2027-W09',
        unaccounted: '310',
        periods: 3,
      }),
    ]);
  });

  it('DT-10: an Iranian plant (week starts Saturday) keys weeks by their Saturday in trend and SQL reports', async () => {
    await env.rows(
      `UPDATE "tenants" SET "week_start" = 'saturday' WHERE "id" = $1`,
      [env.world.tenantA],
    );
    try {
      // Monday 1 Mar 2027 belongs to the week Saturday 27 Feb – Friday 5 Mar
      const weeks = await read<TrendBody>(
        `reconciliation-trend?${scope}&groupBy=week`,
      );
      expect(weeks.data.buckets.map((b) => b.key)).toEqual(['2027-02-27']);
      const downtime = await read<{ groups: Array<{ key: string | null }> }>(
        `downtime?${scope}&groupBy=week`,
      );
      expect(downtime.data.groups.map((g) => g.key)).toEqual(['2027-02-27']);
    } finally {
      await env.rows(
        `UPDATE "tenants" SET "week_start" = 'monday' WHERE "id" = $1`,
        [env.world.tenantA],
      );
    }
    const iso = await read<{ groups: Array<{ key: string | null }> }>(
      `downtime?${scope}&groupBy=week`,
    );
    expect(iso.data.groups.map((g) => g.key)).toEqual(['2027-W09']);
  });

  it('reconciliation status: workflow, residual state, age and overdue periods at a fixed asOf', async () => {
    const later = encodeURIComponent(plus(NEXT_DAY, 72 * HOUR));
    const status = await read<StatusBody>(
      `reconciliation-status?${scope}&asOf=${later}`,
    );
    expect(status.data.periods).toBe(3);
    expect(status.data.workflow.find((w) => w.state === 'draft')?.periods).toBe(
      3,
    );
    expect(
      status.data.residual.find((r) => r.state === 'unaccounted')?.periods,
    ).toBe(3);
    expect(status.data.overdueCount).toBe(3);
    expect(status.data.overdue[0]).toMatchObject({
      periodId: env.periodA1,
      workflowState: 'draft',
    });
    expect(status.data.overdue[0].planId).not.toBeNull();
    expect(status.data.overdue[0].unitName).not.toBeNull();
    const before = await read<StatusBody>(
      `reconciliation-status?${scope}&asOf=${encodeURIComponent(A)}`,
    );
    expect(before.data.ages.find((a) => a.key === 'not_ended')?.periods).toBe(
      3,
    );
    expect(before.data.overdueCount).toBe(0);
  });

  it('actuals quality counts the stored results of the shown runs', async () => {
    const quality = await read<QualityBody>(`actuals-quality?${scope}`);
    expect(quality.data).toMatchObject({
      periods: 3,
      slices: 3,
      periodsWithoutActuals: 0,
    });
    const states = quality.data.qualityStates.reduce((n, s) => n + s.slices, 0);
    expect(states).toBe(3);
    expect(quality.data.coverage.reduce((n, c) => n + c.slices, 0)).toBe(3);
    expect(quality.data.quantities.map((q) => q.uom)).toEqual(['t']);
  });

  it('is tenant and unit scoped: foreign units 422, tenantId in the query 400, tenant B sees no periods', async () => {
    for (const path of [
      'scope-waterfall',
      'loss-tree',
      'reconciliation-trend',
      'reconciliation-status',
      'actuals-quality',
    ]) {
      const foreign = await env
        .get(`reports/${path}?unitIds=${env.world.unitB1}&${window}`)
        .expect(422);
      expect((foreign.body as ApiError).code).toBe('INVALID_REFERENCE');
      await env
        .get(`reports/${path}?${window}&tenantId=${env.world.tenantA}`)
        .expect(400);
    }
    const other = await read<StatusBody>(
      `reconciliation-status?${window}`,
      env.adminB,
    );
    expect(other.data.periods).toBe(0);
    const tree = await read<LossTreeBody>(`loss-tree?${window}`, env.adminB);
    expect(tree.data.groups).toEqual([]);
  });

  it('DB-08: runs without a recorded tolerance (pre-2.5) read the policy in force in one lookup, same figures', async () => {
    const paths = [
      `reconciliation-trend?${scope}&groupBy=shift`,
      `reconciliation-status?${scope}&asOf=${encodeURIComponent(NEXT_DAY)}`,
    ];
    const before = await Promise.all(paths.map((p) => read(p)));
    const saved = await env.rows<{ id: string; policy_versions: unknown }>(
      `SELECT "id", "policy_versions" FROM "calculation_runs" WHERE "tenant_id" = $1`,
      [env.world.tenantA],
    );
    await env.rows(
      `UPDATE "calculation_runs" SET "policy_versions" = coalesce((SELECT jsonb_agg(v) FROM
         jsonb_array_elements("policy_versions") v WHERE v->>'kind' <> 'reconciliation_tolerance'), '[]'::jsonb)
        WHERE "tenant_id" = $1`,
      [env.world.tenantA],
    );
    try {
      const after = await Promise.all(paths.map((p) => read(p)));
      expect(after.map((r) => r.data)).toEqual(before.map((r) => r.data));
    } finally {
      for (const run of saved) {
        await env.rows(
          `UPDATE "calculation_runs" SET "policy_versions" = $2::jsonb WHERE "id" = $1`,
          [run.id, JSON.stringify(run.policy_versions)],
        );
      }
    }
  });

  it('DB-08: the batch lookup resolves like resolveEngine — the unit version over the tenant one, by instant', async () => {
    const { tenantA, unitA1, unitA2 } = env.world;
    const unitFrom = plus(A, 2 * HOUR);
    await env.rows(
      `INSERT INTO "accounting_policies" ("tenant_id", "row_version", "policy_kind", "unit_id", "scope_key",
              "version", "body", "effective_from", "approved_at")
       SELECT $1, 1, 'reconciliation_tolerance', $2::uuid, $4, 1,
              jsonb_set("body", '{unaccountedTargetOfShortfall}', '0.5'), $3, now()
         FROM "accounting_policies" WHERE "tenant_id" = $1 AND "policy_kind" = 'reconciliation_tolerance'
        ORDER BY "version" DESC LIMIT 1`,
      [tenantA, unitA1, unitFrom, `unit:${unitA1}`],
    );
    const at = (unitId: string, instant: string) => ({
      tenantId: tenantA,
      unitId,
      at: new Date(instant),
    });
    const lookups = [at(unitA1, A), at(unitA1, unitFrom), at(unitA2, unitFrom)];
    const manager = env.harness.dataSource.manager;
    const bodies = await policyBodiesInForce(
      manager,
      'reconciliation_tolerance',
      lookups,
    );
    const policies = new AccountingPoliciesService();
    const targets: number[] = [];
    for (const [i, lookup] of lookups.entries()) {
      const engine = await policies.resolveEngine(manager, lookup, lookup.at);
      const batched = parseReconciliationTolerance(bodies[i]);
      expect(batched).toEqual(engine.tolerance);
      targets.push(batched.unaccountedTargetOfShortfall ?? -1);
    }
    // only unit A1 from unitFrom on sees its own version
    expect(targets[1]).toBe(0.5);
    expect(targets[0]).not.toBe(0.5);
    expect(targets[2]).toBe(targets[0]);
    await env.rows(
      `DELETE FROM "accounting_policies" WHERE "unit_id" = $1 AND "policy_kind" = 'reconciliation_tolerance'`,
      [unitA1],
    );
  });
});
