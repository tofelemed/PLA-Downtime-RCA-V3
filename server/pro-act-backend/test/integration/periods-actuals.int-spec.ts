import { PeriodSweepJob } from '../../src/periods/period-sweep.job';
import {
  A,
  ActualsWorld,
  B,
  C,
  HOUR,
  NEXT_DAY,
  PeriodDetailBody,
  SliceActualsBody,
} from './support/actuals-world';
import { DAY1, DAY3 } from './support/plan-world';

const plus = (iso: string, ms: number) =>
  new Date(Date.parse(iso) + ms).toISOString();
const hourly = (from: number, value: string): Array<[number, string]> =>
  Array.from({ length: Math.floor((480 - from) / 60) + 1 }, (_, i) => [
    from + i * 60,
    value,
  ]);
const only = (detail: PeriodDetailBody): SliceActualsBody => {
  expect(detail.data.slices).toHaveLength(1);
  const actuals = detail.data.slices[0].actuals;
  if (!actuals) throw new Error('slice without actuals');
  return actuals;
};
const codes = (actuals: SliceActualsBody) =>
  actuals.exceptions.map((e) => e.code);

/**
 * Plan 2.4: periods materialize per shift instance with product slices; the actuals runner persists
 * T25 / T26 / T27 with method, quantity and coverage; a 10 % sample gap gives coverage 0.9; competing PI
 * output events and an MQTT counter select one authority with a visible conflict (T12); a spanning output
 * event is split as an estimate or, when the policy forbids it, leaves the slice partial; the
 * compatibility view and the worker sweep.
 */
describe('production periods and actuals results (plan 2.4)', () => {
  const env = new ActualsWorld();
  let planId = '';

  beforeAll(async () => {
    await env.start();
    const { unitA1, unitA3 } = env.world;
    planId = (
      await env.approvedPlan(unitA1, { validTo: DAY3, headerTarget: '2000' })
    ).id;
    await env.unitPolicy(unitA3, 'source_authority', {
      measurement: 'output',
      productId: null,
      primarySource: 'pi_rate',
      fallback: { conditions: ['primary_missing'], source: 'pi_counter' },
      cadenceSeconds: 60,
      conflictTolerance: 0,
      overrideRole: 'integration_admin',
    });
    await env.unitPolicy(unitA1, 'source_authority', {
      measurement: 'output',
      productId: null,
      primarySource: 'pi_output_ef',
      fallback: { conditions: ['primary_missing'], source: 'mqtt' },
      cadenceSeconds: 60,
      conflictTolerance: 0,
      overrideRole: 'integration_admin',
    });
  });
  afterAll(() => env.stop());

  it('materializes one period per shift instance with plan or default-product slices (idempotent)', async () => {
    const { unitA1, unitA3 } = env.world;
    const first = await env.materialize([unitA1, unitA3], DAY1, DAY3);
    expect(first).toMatchObject({ created: 12, skipped: 0 });
    expect((await env.materialize([unitA1, unitA3], DAY1, DAY3)).created).toBe(
      0,
    );
    const a1 = await env.detail(await env.periodId(unitA1, A));
    expect(a1.data.slices).toEqual([
      expect.objectContaining({ productId: env.products.p1, source: 'plan' }),
    ]);
    const a3 = await env.detail(await env.periodId(unitA3, A));
    expect(a3.data.slices).toEqual([
      expect.objectContaining({
        productId: env.products.p1,
        source: 'profile_default',
      }),
    ]);
    const list = await env
      .get(`production-periods?unitIds=${unitA1}&from=${DAY1}&to=${NEXT_DAY}`)
      .expect(200);
    expect((list.body as { items: unknown[] }).items).toHaveLength(3);
  });

  it('T25 persisted: a 120 t/h rate for 30 min gives 60 t by rate integration, full coverage', async () => {
    const id = await env.signal({
      unitId: env.world.unitA3,
      semanticType: 'rate',
      from: A,
      to: B,
    });
    await env.samples(id, A, [
      [0, '120'],
      [30, '0'],
      ...hourly(90, '0'),
      [480, '0'],
    ]);
    const actuals = only(
      await env.recompute(await env.periodId(env.world.unitA3, A)),
    );
    expect(actuals).toMatchObject({
      gross: '60',
      good: '60',
      reject: null,
      uom: 't',
      method: 'rate_integration',
      coverageRatio: '1',
      measuredQty: '60',
      qualityState: 'complete',
    });
    expect(codes(actuals)).toContain('rejects_not_measured');
  });

  it('T26 persisted: a rollover 995 → 5 gives 10 t by counter delta (policy fallback)', async () => {
    const id = await env.signal({
      unitId: env.world.unitA3,
      semanticType: 'counter',
      from: B,
      to: C,
      timebase: 'h',
      resetPolicy: 'detect_drop',
      rolloverModulus: '1000',
      expectedMax: '500',
    });
    await env.samples(id, B, [
      [0, '995'],
      [6, '5'],
      ...hourly(66, '5'),
      [480, '5'],
    ]);
    const actuals = only(
      await env.recompute(await env.periodId(env.world.unitA3, B)),
    );
    expect(actuals).toMatchObject({
      gross: '10',
      method: 'counter_delta',
      coverageRatio: '1',
    });
    expect(codes(actuals)).toContain('fallback_used');
  });

  it('T27 persisted: a drop without reset evidence is null with reset_unresolved, never 990 or 1010', async () => {
    const id = await env.signal({
      unitId: env.world.unitA3,
      semanticType: 'counter',
      from: C,
      to: NEXT_DAY,
      timebase: 'h',
      resetPolicy: 'detect_drop',
    });
    await env.samples(id, C, [[0, '1000'], ...hourly(60, '10')]);
    const actuals = only(
      await env.recompute(await env.periodId(env.world.unitA3, C)),
    );
    expect(actuals).toMatchObject({
      gross: null,
      good: null,
      method: 'counter_delta',
      qualityState: 'partial',
    });
    expect(codes(actuals)).toContain('reset_unresolved');
  });

  it('missing samples for 10 % of the window give coverage 0.9 and a measured quantity only', async () => {
    const id = await env.signal({
      unitId: env.world.unitA3,
      semanticType: 'rate',
      from: NEXT_DAY,
      to: plus(NEXT_DAY, 8 * HOUR),
      maxGapSeconds: 900,
    });
    const points: Array<[number, string]> = Array.from(
      { length: 29 },
      (_, i) => [i * 15, '60'],
    );
    await env.samples(id, NEXT_DAY, [...points, [432, '60']]);
    const actuals = only(
      await env.recompute(await env.periodId(env.world.unitA3, NEXT_DAY)),
    );
    expect(actuals).toMatchObject({
      gross: '432',
      coverageRatio: '0.9',
      measuredQty: '432',
      estimatedQty: '0',
      qualityState: 'partial',
    });
  });

  it('T12: PI output events and an MQTT counter → one authority, conflict visible, output not doubled', async () => {
    const unit = env.world.unitA1;
    await env.outputEvent(unit, A, plus(A, 4 * HOUR), '100');
    await env.outputEvent(unit, plus(A, 4 * HOUR), B, '100');
    const mqtt = await env.signal({
      unitId: unit,
      semanticType: 'counter',
      connection: 'mqtt',
      from: A,
      to: B,
      maxGapSeconds: 5 * 3600,
    });
    await env.samples(mqtt, A, [
      [0, '0'],
      [240, '90'],
      [480, '190'],
    ]);
    const actuals = only(await env.recompute(await env.periodId(unit, A)));
    expect(actuals).toMatchObject({
      gross: '200',
      method: 'output_events',
      qualityState: 'conflict',
      coverageRatio: '1',
    });
    const conflict = actuals.exceptions.find(
      (e) => e.code === 'source_conflict',
    );
    expect(conflict?.detail).toMatchObject({
      selectedQuantity: '200',
      otherQuantity: '190',
    });
  });

  it('a spanning output event is split in proportion as an estimate; a policy forbidding it leaves the slice partial', async () => {
    const unit = env.world.unitA1;
    await env.outputEvent(unit, plus(B, 6 * HOUR), plus(C, 2 * HOUR), '80');
    const b = only(await env.recompute(await env.periodId(unit, B)));
    expect(b).toMatchObject({
      gross: '40',
      estimatedQty: '40',
      measuredQty: '0',
    });
    expect(codes(b)).toContain('proportional_estimate');
    expect(only(await env.recompute(await env.periodId(unit, C))).gross).toBe(
      '40',
    );

    await env.unitPolicy(unit, 'coverage_gate', {
      requiredCoverageRatio: 1,
      allowProportionalEstimate: false,
      countApprovedSubstitutionsAsAccepted: true,
    });
    const strictB = only(await env.recompute(await env.periodId(unit, B)));
    expect(strictB).toMatchObject({ gross: null, qualityState: 'partial' });
    expect(codes(strictB)).toContain('spanning_event');
    const strictC = only(await env.recompute(await env.periodId(unit, C)));
    expect(strictC).toMatchObject({ gross: '80', qualityState: 'partial' });
  });

  it('the v1 compatibility view exposes period, actual and short-range plan from periods', async () => {
    const rows = await env.rows<Record<string, unknown>>(
      `SELECT plan_id, period, actual::text AS actual, short_range_plan::text AS plan FROM production_losses_v
        WHERE unit_id = $1 AND utc_start = $2`,
      [env.world.unitA1, A],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ plan_id: planId, period: '2027-03-01 A' });
    expect(Number(rows[0].actual)).toBe(200);
    expect(Number(rows[0].plan)).toBeGreaterThan(0);
  });

  it('results are immutable', async () => {
    await expect(
      env.rows(`UPDATE actuals_results SET gross = 1`),
    ).rejects.toThrow(/immutable/);
    await expect(env.rows(`DELETE FROM actuals_runs`)).rejects.toThrow(
      /immutable/,
    );
  });

  it('the sweep creates started periods and queues settled periods without a run or with late samples', async () => {
    const { unitA3 } = env.world;
    const [signal] = await env.rows<{ id: string }>(
      `SELECT id FROM signals WHERE unit_id = $1 AND effective_from = $2`,
      [unitA3, A],
    );
    await env.samples(signal.id, A, [[240, '0']]);
    const now = new Date(plus(NEXT_DAY, 12 * HOUR));
    const result = await env.app.get(PeriodSweepJob).sweep(now);
    expect(result.created).toBeGreaterThan(0);
    const queued = await env.rows<{ period_id: string }>(
      `SELECT period_id FROM actuals_jobs WHERE state = 'queued' AND request->>'trigger' = 'period_settled'`,
    );
    expect(queued.map((row) => row.period_id)).toContain(
      await env.periodId(unitA3, A),
    );
    expect(queued.map((row) => row.period_id)).not.toContain(
      await env.periodId(unitA3, B),
    );
    await env.runActuals();
  });
});
