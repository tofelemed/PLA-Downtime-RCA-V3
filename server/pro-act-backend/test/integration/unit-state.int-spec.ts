import { A, B, SignalSpec } from './support/actuals-world';
import { AccountingWorld, plus } from './support/accounting-world';
import { ApiError } from './support/plan-world';

const MINUTE = 60_000;

interface CoverageBody {
  coverage: {
    scheduledSeconds: number;
    runningSeconds: number;
    knownStoppedSeconds: number;
    unknownSeconds: number;
    coverage: number;
    availabilityLower: number;
    availabilityUpper: number;
  } | null;
  coverageStartsAt: string | null;
  segments: Array<{ state: string; unknownReason: string | null }>;
}

/**
 * SME D1 / D2 on real Postgres: a unit's state signal mapped to physical states with a 10 min heartbeat
 * (stale after 3 intervals). 6 h running, then stopped samples until 20 min before the end of an 8 h
 * window: the last stopped sample holds 30 min, the rest is unknown and never filled. The endpoint and the
 * period KPIs publish the same coverage and availability bounds.
 */
describe('unit state engine: mapping, staleness and coverage bounds (SME D1, D2)', () => {
  const env = new AccountingWorld();
  let periodA1 = '';
  let signalId = '';

  const metric = async (name: string) => {
    const [row] = await env.rows<{ value: string | null; quality: string }>(
      `SELECT k."value"::text AS "value", k."quality" FROM "kpi_results" k
         JOIN "accounting_revisions" ar ON ar."current_run_id" = k."run_id"
        WHERE ar."period_id" = $1 AND k."metric" = $2 AND k."scope"->>'level' = 'period'`,
      [periodA1, name],
    );
    return row;
  };

  beforeAll(async () => {
    await env.start();
    await env.approvedPlan(env.world.unitA1);
    await env.materialize([env.world.unitA1]);
    periodA1 = await env.periodId(env.world.unitA1, A);
    await env.outputEvent(env.world.unitA1, A, B, '300');
    signalId = await env.signal({
      unitId: env.world.unitA1,
      semanticType: 'state',
      from: plus(A, -24 * 60 * MINUTE),
      to: null,
    } as unknown as SignalSpec);
    const running = Array.from({ length: 36 }, (_, i): [number, string] => [
      i * 10,
      '1',
    ]);
    const stopped = Array.from({ length: 6 }, (_, i): [number, string] => [
      360 + i * 10,
      '0',
    ]);
    await env.samples(signalId, A, [...running, ...stopped]);
  });
  afterAll(() => env.stop());

  it('records a mapping version for a state signal of the unit; other units and signals are refused', async () => {
    const body = {
      unitId: env.world.unitA1,
      signalId,
      rules: [
        { match: '1', state: 'running' },
        { match: '0', state: 'internal_stop' },
      ],
      expectedIntervalSeconds: 600,
      effectiveFrom: plus(A, -60 * MINUTE),
      notes: 'test mapping',
    };
    const created = await env.post('unit-state-mappings', body).expect(201);
    expect(created.body).toMatchObject({
      version: 1,
      staleAfterIntervals: 3,
      staleAfterSeconds: 1800,
    });
    const wrongUnit = await env
      .post('unit-state-mappings', { ...body, unitId: env.world.unitA2 })
      .expect(422);
    expect((wrongUnit.body as ApiError).code).toBe('INVALID_REFERENCE');
    const scoped = await env.unitUser(env.world.unitA2, 'integration_admin');
    await env.post('unit-state-mappings', body, scoped).expect(422);
  });

  it('never fills the gap: availability between running / scheduled and (running + unknown) / scheduled', async () => {
    const response = await env
      .get(
        `unit-state-mappings/coverage?unitId=${env.world.unitA1}&from=${A}&to=${B}`,
      )
      .expect(200);
    const body = response.body as CoverageBody;
    expect(body.segments.map((s) => [s.state, s.unknownReason])).toEqual([
      ['running', null],
      ['internal_stop', null],
      ['unknown', 'stale'],
    ]);
    expect(body.coverageStartsAt).toBeNull();
    const c = body.coverage;
    expect(c).toMatchObject({
      runningSeconds: 6 * 3600,
      knownStoppedSeconds: 80 * 60,
      unknownSeconds: 40 * 60,
    });
    expect(c?.availabilityLower).toBeCloseTo(
      (6 * 3600) / (c?.scheduledSeconds ?? 1),
      6,
    );
    await env.settle();
    expect(
      Number((await metric('availability_lower_bound')).value),
    ).toBeCloseTo(c?.availabilityLower ?? 0, 6);
    expect(
      Number((await metric('availability_upper_bound')).value),
    ).toBeCloseTo(c?.availabilityUpper ?? 0, 6);
    const coverage = await metric('state_coverage');
    expect(Number(coverage.value)).toBeCloseTo(c?.coverage ?? 0, 6);
    expect(coverage.quality).toBe('provisional');
  });

  it('a window starting before the first mapping counts from that mapping, and says so (QA M3)', async () => {
    const from = plus(A, -3 * 60 * MINUTE);
    const response = await env
      .get(
        `unit-state-mappings/coverage?unitId=${env.world.unitA1}&from=${from}&to=${B}`,
      )
      .expect(200);
    const body = response.body as CoverageBody;
    const mappingStart = new Date(plus(A, -60 * MINUTE)).toISOString();
    expect(body.coverageStartsAt).toBe(mappingStart);
    expect(body.coverage).not.toBeNull();
    expect(body.segments.map((s) => s.state)).toContain('running');
    expect(body.coverage?.runningSeconds).toBe(6 * 3600);
  });

  it('a window wholly before the first mapping has no coverage', async () => {
    const response = await env
      .get(
        `unit-state-mappings/coverage?unitId=${env.world.unitA1}&from=${plus(A, -5 * 60 * MINUTE)}&to=${plus(A, -2 * 60 * MINUTE)}`,
      )
      .expect(200);
    const body = response.body as CoverageBody;
    expect(body.coverage).toBeNull();
    expect(body.coverageStartsAt).toBeNull();
  });
});
