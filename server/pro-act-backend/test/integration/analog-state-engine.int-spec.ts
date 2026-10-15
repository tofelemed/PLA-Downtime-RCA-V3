import { DerivedStopEngineService } from '../../src/stop-events/derived-stop-engine.service';
import { A, SignalSpec } from './support/actuals-world';
import { AccountingWorld, plus } from './support/accounting-world';
import { ApiError } from './support/plan-world';

const MINUTE = 60_000;

interface EventRow {
  physical_type: string;
  oee_component: string;
  impact_mode: string;
  impact_fraction: string | null;
  start_time: Date;
  end_time: Date | null;
}

interface PreviewBody {
  stops: Array<{ state: string; startTime: string; endTime: string | null }>;
  slowdowns: Array<{
    startTime: string;
    endTime: string | null;
    fraction: string | null;
  }>;
}

/**
 * Plan 1.10 analog state mapping on real Postgres: unit A1's throughput signal (t/h, rated 20, one sample
 * a minute) is banded by thresholds with hysteresis — 30 min at 20, 30 min at 15 (reduced rate), 20 min
 * at 0 (stopped), then 20 again. The preview and the engine give one stop (availability) and one slowdown
 * (performance, a 25 % derate), never a stop for the reduced rate.
 */
describe('analog thresholds and reduced-rate slowdowns (plan 1.10)', () => {
  const env = new AccountingWorld();
  let signalId = '';
  const now = () => new Date(Date.parse(A) + 125 * MINUTE);
  const scope = () => ({
    tenantId: env.world.tenantA,
    unitId: env.world.unitA1,
  });

  const value = (minute: number) => {
    if (minute >= 30 && minute < 60) return '15';
    if (minute >= 60 && minute < 80) return '0';
    return '20';
  };

  beforeAll(async () => {
    await env.start();
    signalId = await env.signal({
      unitId: env.world.unitA1,
      semanticType: 'rate',
      from: plus(A, -24 * 60 * MINUTE),
      to: null,
    } as unknown as SignalSpec);
    const points = Array.from({ length: 125 }, (_, i): [number, string] => [
      i,
      value(i),
    ]);
    await env.samples(signalId, A, points);
  });
  afterAll(() => env.stop());

  it('refuses a mapping without rules or thresholds and a reduced threshold below the stop one', async () => {
    const base = {
      unitId: env.world.unitA1,
      signalId,
      rules: [],
      expectedIntervalSeconds: 60,
      effectiveFrom: plus(A, -60 * MINUTE),
    };
    await env.post('unit-state-mappings', base).expect(422);
    const inverted = await env
      .post('unit-state-mappings', {
        ...base,
        thresholds: { stopBelow: 5, reducedBelow: 2 },
      })
      .expect(422);
    expect((inverted.body as ApiError).message).toBeDefined();
    const created = await env
      .post('unit-state-mappings', {
        ...base,
        thresholds: {
          stopBelow: 2,
          reducedBelow: 16,
          hysteresis: 0.5,
          ratedValue: 20,
        },
      })
      .expect(201);
    expect(created.body).toMatchObject({
      thresholds: {
        stopBelow: 2,
        reducedBelow: 16,
        hysteresis: 0.5,
        stopState: 'internal_stop',
        ratedValue: 20,
      },
    });
  });

  it('the preview shows one stop and one 25 % slowdown', async () => {
    const preview = (
      await env
        .get(
          `derived-stops/preview?unitId=${env.world.unitA1}&from=${plus(A, 0)}&to=${now().toISOString()}`,
        )
        .expect(200)
    ).body as PreviewBody;
    expect(preview.stops).toEqual([
      expect.objectContaining({
        state: 'internal_stop',
        startTime: plus(A, 60 * MINUTE),
        endTime: plus(A, 80 * MINUTE),
      }),
    ]);
    expect(preview.slowdowns).toEqual([
      expect.objectContaining({
        startTime: plus(A, 30 * MINUTE),
        endTime: plus(A, 60 * MINUTE),
        fraction: '0.25',
      }),
    ]);
  });

  it('the engine writes the stop as availability downtime and the slowdown as a performance derate', async () => {
    const outcome = await env.app
      .get(DerivedStopEngineService)
      .processUnit(scope(), now());
    expect(outcome).toMatchObject({
      created: 1,
      slowdowns: { created: 1, updated: 0, retracted: 0 },
    });
    const rows = await env.rows<EventRow>(
      `SELECT "physical_type", "oee_component", "impact_mode"::text AS "impact_mode",
              "impact_fraction"::text AS "impact_fraction", "start_time", "end_time"
         FROM "production_events" WHERE "unit_id" = $1 AND "source_kind" = 'derived'
        ORDER BY "start_time"`,
      [env.world.unitA1],
    );
    expect(
      rows.map((r) => [r.physical_type, r.oee_component, r.impact_mode]),
    ).toEqual([
      ['slowdown', 'performance', 'fractional'],
      ['downtime', 'availability', 'full_stop'],
    ]);
    expect(Number(rows[0].impact_fraction)).toBe(0.25);
    const again = await env.app
      .get(DerivedStopEngineService)
      .processUnit(scope(), now());
    expect(again).toEqual({ created: 0, updated: 0, retracted: 0 });
  });
});
