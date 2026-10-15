import { randomUUID } from 'crypto';
import { A, HOUR } from './support/actuals-world';
import { plus } from './support/accounting-world';
import { approvedValuation } from './support/approved-valuation';
import { RcaWorld } from './support/rca-world';

interface Item {
  rank: number;
  key: string;
  assetId: string;
  assetCode: string | null;
  failureMode: string | null;
  stops: number;
  downtimeSeconds: string;
  quantity: string | null;
  quantities: Array<{ uom: string | null; quantity: string }>;
  value: { currency: string; amount: string | null; status: string } | null;
  trigger: {
    state: string;
    thresholdSeconds: number | null;
    criticalAsset: boolean;
    seconds: number;
  };
}

interface Report {
  data: {
    month: string;
    from: string;
    to: string;
    windowDays: number;
    view: string;
    uom: string | null;
    valuationStatus: string;
    items: Item[];
  };
}

const codeOf = (response: { body: unknown }) =>
  (response.body as { code: string }).code;

/**
 * CA8 monthly bad-actor review on real Postgres (test data): the extruder (asset A1) loses approved tonnes
 * in period A1 through a seal leak; a critical pump has two unapproved bearing stops of 5.5 h in March (no
 * approved loss). Ranked on the server by approved quantity, value (policy default view: economic) or
 * stops, per asset or failure mode, over the policy's 90 days ending at the end of March, with the
 * cumulative trigger state (4 h for a critical asset). Scope from identity; other units are 422.
 */
describe('bad-actor report (CA8)', () => {
  const env = new RcaWorld();
  const pump = randomUUID();
  const report = async (query: string, token = env.admin) =>
    (
      (await env.get(`reports/bad-actors?${query}`, token).expect(200))
        .body as Report
    ).data;

  const stop = (start: string, hours: number, extra: object) =>
    env
      .post('production-events', {
        unitId: env.world.unitA1,
        eventType: 'ProductionLoss',
        physicalType: 'downtime',
        scheduleClass: 'unplanned',
        startTime: start,
        endTime: plus(start, hours * HOUR),
        ...extra,
      })
      .expect(201);

  beforeAll(async () => {
    await env.start();
    await env.rows(
      `INSERT INTO assets (id, code, name, unit_id, tenant_id, criticality) VALUES ($1, 'P-101', 'Feed pump', $2, $3, 'Critical')`,
      [pump, env.world.unitA1, env.world.tenantA],
    );
    const reason = await env.reasonCode('EXT');
    await env.lossEvent(env.world.unitA1, plus(A, HOUR), 1, {
      reasonCodeId: reason,
      assetId: env.world.assetA1,
      failureMode: 'Seal leak',
      scheduleClass: 'unplanned',
    });
    await stop('2027-03-20T08:00:00.000Z', 0.5, {
      assetId: pump,
      failureMode: 'Bearing',
    });
    await stop('2027-03-21T08:00:00.000Z', 5, {
      assetId: pump,
      failureMode: 'bearing ',
    });
    await env.settle();
    await approvedValuation(env);
    await env.settle();
    await env.approvePeriodA1(reason);
  });
  afterAll(() => env.stop());

  it('by approved quantity (default): the extruder first with its approved economic value; the window is 90 days to month end', async () => {
    const data = await report('month=2027-03');
    expect(data).toMatchObject({
      month: '2027-03',
      to: '2027-04-01T00:00:00.000Z',
      from: '2027-01-01T00:00:00.000Z',
      windowDays: 90,
      view: 'economic_impact',
      uom: 't',
    });
    // only assets with approved loss compete on approved quantity: the pump's stops are not approved loss
    expect(data.items).toHaveLength(1);
    const [first] = data.items;
    expect(first).toMatchObject({
      rank: 1,
      assetId: env.world.assetA1,
      stops: 1,
      failureMode: null,
    });
    expect(Number(first.quantity)).toBeGreaterThan(0);
    expect(first.value).toMatchObject({ currency: 'USD', status: 'valued' });
    expect(Number(first.value?.amount)).toBe(Number(first.quantity) * 300);
  });

  it('the critical pump is over its halved bad-actor limit (5.5 h ≥ 4 h); by stops it ranks first', async () => {
    const data = await report('month=2027-03&rankBy=stops&limit=1');
    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toMatchObject({
      assetId: pump,
      assetCode: 'P-101',
      stops: 2,
      downtimeSeconds: '19800',
    });
    expect(data.items[0].trigger).toMatchObject({
      thresholdSeconds: 14400,
      criticalAsset: true,
      seconds: 19800,
    });
    expect(['fired', 'over_threshold']).toContain(data.items[0].trigger.state);
  });

  it('per failure mode the CA8 identity is normalized (case and spacing); by value only valued loss competes', async () => {
    const byStops = await report(
      'month=2027-03&groupBy=failure_mode&rankBy=stops',
    );
    expect(byStops.items.map((i) => [i.failureMode, i.stops])).toEqual([
      ['mode:bearing', 2],
      ['mode:seal leak', 1],
    ]);
    const byValue = await report(
      'month=2027-03&groupBy=failure_mode&rankBy=value&currency=IRR',
    );
    expect(byValue.items.map((i) => i.failureMode)).toEqual(['mode:seal leak']);
    expect(byValue.items[0].value).toMatchObject({
      currency: 'IRR',
      amount: null,
      status: 'mixed',
    });
  });

  it('another month has nothing; scope comes from identity (other units 422, a malformed month 422)', async () => {
    expect((await report('month=2027-07')).items).toEqual([]);
    const limited = await env.unitUser(
      env.world.unitA1,
      'reliability_engineer',
    );
    const other = await env
      .get(
        `reports/bad-actors?month=2027-03&unitIds=${env.world.unitA2}`,
        limited,
      )
      .expect(422);
    expect(codeOf(other)).toBe('INVALID_REFERENCE');
    await env.get('reports/bad-actors?month=2027-3').expect(422);
    expect((await report('month=2027-03', env.adminB)).items).toEqual([]);
  });
});
