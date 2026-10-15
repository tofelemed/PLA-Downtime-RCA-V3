import { randomUUID } from 'crypto';
import {
  exposureWindow,
  ModeFootprint,
} from '../../src/rca-case/effectiveness-exposure';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';

const FROM = new Date('2026-11-01T00:00:00.000Z');
const TO = new Date('2026-11-11T00:00:00.000Z');

/**
 * CA2 / CA4 on real Postgres (owner, 15 Oct 2026): the effectiveness exposure of a case about a standby
 * pump is the pump's own running time from the standby log (28 h, mostly during the unit's planned stop),
 * not the unit run time (214 h of 240 h); a case that also names a duty asset, and a verification that
 * froze the unit basis with its baseline, keep the unit run time. Incidents are counted the same way.
 */
describe('RCA effectiveness exposure of standby equipment (CA2 / CA4)', () => {
  const harness = new IntegrationHarness();
  let world: EventWorld;

  const footprint = (assetIds: string[]): ModeFootprint => ({
    assetIds,
    unitIds: [world.unitA1],
    modeKeys: [],
    match: 'asset',
  });
  const exposure = (assetIds: string[], basis?: 'unit_run_time') =>
    exposureWindow(harness.dataSource.manager, {
      tenantId: world.tenantA,
      footprint: footprint(assetIds),
      from: FROM,
      to: TO,
      ...(basis ? { basis } : {}),
    });

  async function downtime(
    assetId: string | null,
    scheduleClass: 'planned' | 'unplanned',
    span: [string, string],
  ): Promise<void> {
    await harness.dataSource.query(
      `INSERT INTO production_events
         (unit_id, tenant_id, asset_id, start_time, end_time, source, event_type, physical_type, schedule_class,
          oee_component, impact_mode, physical_state, status)
       VALUES ($1, $2, $3, $4, $5, 'Manual', 'ProductionLoss', 'downtime', $6, 'availability', 'full_stop', 'closed', 'Open')`,
      [world.unitA1, world.tenantA, assetId, span[0], span[1], scheduleClass],
    );
  }

  async function run(start: string, end: string): Promise<void> {
    await harness.dataSource.query(
      `INSERT INTO standby_records (tenant_id, row_version, asset_id, unit_id, record_kind, started_at, ended_at, outcome)
       VALUES ($1, 1, $2, $3, 'run', $4, $5, 'success')`,
      [world.tenantA, world.assetA1, world.unitA1, start, end],
    );
  }

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    await downtime(null, 'planned', [
      '2026-11-02T00:00:00Z',
      '2026-11-03T00:00:00Z',
    ]);
    await downtime(world.assetA1, 'unplanned', [
      '2026-11-05T00:00:00Z',
      '2026-11-05T02:00:00Z',
    ]);
    await harness.dataSource.query(
      `INSERT INTO standby_equipment (tenant_id, row_version, asset_id, unit_id, evaluation, effective_from)
       VALUES ($1, 1, $2, $3, 'running', '2026-10-01T00:00:00Z')`,
      [world.tenantA, world.assetA1, world.unitA1],
    );
    await run('2026-11-02T00:00:00Z', '2026-11-03T00:00:00Z');
    await run('2026-11-04T22:00:00Z', '2026-11-05T02:00:00Z');
    await run('2026-11-20T00:00:00Z', '2026-11-21T00:00:00Z');
  });
  afterAll(() => harness.stop());

  it("a case about the standby pump is exposed for the pump's own running time", async () => {
    const window = await exposure([world.assetA1]);
    expect(window).toMatchObject({
      incidents: 1,
      exposureBasis: 'standby_running_time',
    });
    expect(Number(window.exposureSeconds)).toBe(28 * 3600);
    expect(Number(window.downtimeSeconds)).toBe(2 * 3600);
  });

  it('a duty asset in the case, or a frozen unit basis, keeps the unit run time', async () => {
    const mixed = await exposure([world.assetA1, randomUUID()]);
    expect(mixed.exposureBasis).toBe('unit_run_time');
    expect(Number(mixed.exposureSeconds)).toBe(214 * 3600);
    const frozen = await exposure([world.assetA1], 'unit_run_time');
    expect(frozen).toMatchObject({
      incidents: 1,
      exposureBasis: 'unit_run_time',
    });
    expect(Number(frozen.exposureSeconds)).toBe(214 * 3600);
  });
});
