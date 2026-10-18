import { effectivenessOf } from '../../src/domain/rca/effectiveness';
import {
  exposureWindow,
  EXPOSURE_QUERY_VERSION,
  ModeFootprint,
} from '../../src/rca-case/effectiveness-exposure';
import { A, ActualsWorld, MINUTE, SignalSpec } from './support/actuals-world';

const plus = (iso: string, ms: number) =>
  new Date(Date.parse(iso) + ms).toISOString();

/**
 * CA2 / SME D2 on real Postgres (rca-exposure-v3, Marun E2E): the effectiveness exposure of a unit is its
 * KNOWN running time from the state timeline. A 1-minute heartbeat runs for 2 h, the feed stops for 2 h,
 * runs 1 h more and stops for the rest of the 6 h window: only 184 min are known (each heartbeat holds 3
 * min), a 10-min recorded stop is removed, and the window's coverage is reported. The verdict on such a
 * window is insufficient evidence (a repeat during the gap would go unseen), never "effective".
 */
describe('RCA effectiveness exposure from the unit state timeline (CA2 / D2, v3)', () => {
  const env = new ActualsWorld();
  const from = new Date(A);
  const to = new Date(Date.parse(A) + 360 * MINUTE);

  const footprint = (): ModeFootprint => ({
    assetIds: [],
    unitIds: [env.world.unitA2],
    modeKeys: [],
    match: 'asset',
  });
  const exposure = (window: { from: Date; to: Date } = { from, to }) =>
    exposureWindow(env.harness.dataSource.manager, {
      tenantId: env.world.tenantA,
      footprint: footprint(),
      ...window,
    });

  beforeAll(async () => {
    await env.start();
    const signalId = await env.signal({
      unitId: env.world.unitA2,
      semanticType: 'state',
      from: plus(A, -24 * 60 * MINUTE),
      to: null,
    } as unknown as SignalSpec);
    await env
      .post('unit-state-mappings', {
        unitId: env.world.unitA2,
        signalId,
        rules: [
          { match: '1', state: 'running' },
          { match: '0', state: 'internal_stop' },
        ],
        expectedIntervalSeconds: 60,
        effectiveFrom: plus(A, -60 * MINUTE),
      })
      .expect(201);
    const minutes = [
      ...Array.from({ length: 120 }, (_, i) => i),
      ...Array.from({ length: 60 }, (_, i) => 240 + i),
    ];
    await env.samples(
      signalId,
      A,
      minutes.map((m): [number, string] => [m, '1']),
    );
    await env.rows(
      `INSERT INTO production_events
         (unit_id, tenant_id, start_time, end_time, source, event_type, physical_type, schedule_class,
          oee_component, impact_mode, physical_state, status)
       VALUES ($1, $2, $3, $4, 'Manual', 'ProductionLoss', 'downtime', 'unplanned', 'availability', 'full_stop', 'closed', 'Open')`,
      [
        env.world.unitA2,
        env.world.tenantA,
        plus(A, 30 * MINUTE),
        plus(A, 40 * MINUTE),
      ],
    );
  });
  afterAll(() => env.stop());

  it('counts only known running time and reports the coverage of a window with a data gap', async () => {
    expect(EXPOSURE_QUERY_VERSION).toBe('rca-exposure-v3');
    const window = await exposure();
    expect(window.incidents).toBe(1);
    expect(Number(window.downtimeSeconds)).toBe(600);
    // known 0–122 and 240–302 min = 184 min; running = 184 − 10 min of the recorded stop
    expect(Number(window.knownSeconds)).toBe(184 * 60);
    expect(Number(window.unknownSeconds)).toBe(176 * 60);
    expect(Number(window.exposureSeconds)).toBe(174 * 60);
    expect(window.coverage).toBe('0.5111');
  });

  it('a window with a gap is insufficient evidence whatever its hours; one fully covered is judged', async () => {
    const post = await exposure();
    const result = effectivenessOf({
      metric: 'recurrences',
      baseline: { ...post, incidents: 5, exposureSeconds: String(3600) },
      correctedBaseline: null,
      post: { ...post, incidents: 0 },
      criteria: {
        requiredReduction: 0.5,
        minExposureHours: 1,
        zeroRepeat: false,
      },
    });
    expect(result.verdict).toBe('insufficient_evidence');
    expect(result.reasons[0]).toContain('state data covers 51.1 %');
    const covered = await exposure({
      from,
      to: new Date(Date.parse(A) + 120 * MINUTE),
    });
    expect(covered.coverage).toBe('1');
    expect(Number(covered.exposureSeconds)).toBe(110 * 60);
  });

  it('time before the unit has a state mapping is unknown, not run time', async () => {
    const before = await exposure({
      from: new Date(Date.parse(A) - 180 * MINUTE),
      to: new Date(Date.parse(A) - 60 * MINUTE),
    });
    expect(before).toMatchObject({
      exposureSeconds: '0',
      coverage: '0',
      unmappedUnitIds: [env.world.unitA2],
    });
  });

  it('a unit without any state mapping verifies as insufficient: it needs a state mapping (owner, 18 Oct)', async () => {
    const window = await exposureWindow(env.harness.dataSource.manager, {
      tenantId: env.world.tenantA,
      footprint: { ...footprint(), unitIds: [env.world.unitA3] },
      from,
      to,
    });
    expect(window).toMatchObject({
      coverage: '0',
      unmappedUnitIds: [env.world.unitA3],
    });
    const result = effectivenessOf({
      metric: 'recurrences',
      baseline: { ...window, incidents: 5, exposureSeconds: String(3600) },
      correctedBaseline: null,
      post: window,
      criteria: {
        requiredReduction: 0.5,
        minExposureHours: 1,
        zeroRepeat: false,
      },
    });
    expect(result.verdict).toBe('insufficient_evidence');
    expect(result.reasons).toEqual(['needs a state mapping for this unit']);
    const mapped = await exposure();
    expect(mapped.unmappedUnitIds).toBeUndefined();
  });
});
