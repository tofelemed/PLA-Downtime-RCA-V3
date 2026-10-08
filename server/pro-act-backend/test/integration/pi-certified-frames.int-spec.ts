import { INestApplication } from '@nestjs/common';
import { IntegrationModule } from '../../src/integration/integration.module';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { IntegrationHarness } from './harness';
import { countRows } from './support/intake-fixtures';
import { PiJobDriver, usePiTestTimings } from './support/pi-certification';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { createIntegrationApp } from './support/test-app';
import {
  OPEN_SENTINEL,
  PiWebApiSimulator,
} from '../simulators/pi-web-api/pi-web-api-simulator';
import { minutesAgo, simFrame } from '../simulators/pi-web-api/sim-fixtures';

const DAY_MINUTES = 24 * 60;

/**
 * Plan 1.6 §6.4 certification rows against the simulator: open-frame sentinel (PI03/T02), a frame
 * open longer than the lookback closing outside the window (T08), an old frame corrected after closure
 * (7-day rescan), typed digital states, missing attributes, asset-only mapping, mixed separators with
 * the ancestor walk, and the per-frame fallback when the batch controller is missing.
 */
describe('PI event frames: open frames, corrections and typed mapping (plan 1.6)', () => {
  const harness = new IntegrationHarness();
  const sim = new PiWebApiSimulator();
  let app: INestApplication;
  let world: EventWorld;
  let pi: PiJobDriver;
  let windowJob: string;
  let openJob: string;
  const rows = <T>(sql: string, params: unknown[] = []): Promise<T[]> =>
    harness.dataSource.query<T[]>(sql, params);
  const lineWebId = 'EL-LINE1';
  const unitWebId = 'EL-U100';
  const pumpWebId = 'EL-PUMP';

  beforeAll(async () => {
    usePiTestTimings();
    await harness.start();
    await sim.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [ProductionEventModule, IntegrationModule],
    });
    pi = new PiJobDriver(app, harness, world.tenantA);
    await pi.connect(sim);
    sim.addElement('\\\\SIM-AF\\HDPE\\Plant\\Line1', lineWebId);
    sim.addElement('\\\\SIM-AF\\HDPE\\Plant\\Line1\\Unit100', unitWebId);
    sim.addElement('\\\\SIM-AF\\HDPE\\Plant\\Line1\\Pump', pumpWebId);
    await bind(lineWebId, world.unitA1, 'unit');
    await bind(pumpWebId, world.assetA1, 'asset');
    windowJob = await pi.startJob({
      scopeType: 'database',
      scopeId: 'DB-HDPE',
    });
    openJob = await pi.startJob({ mode: 'open_frames' });
  });

  afterAll(async () => {
    await harness.dataSource.query(
      `UPDATE ingestion_jobs SET state = 'stopped', lease_owner = NULL WHERE tenant_id = $1`,
      [world.tenantA],
    );
    await app?.close();
    await sim.close();
    await harness.stop();
  });

  const bind = (webId: string, localId: string, type: 'unit' | 'asset') =>
    harness.dataSource.query(
      `INSERT INTO af_bindings (tenant_id, web_id, local_id, bound_type, is_active) VALUES ($1, $2, $3, $4, true)`,
      [world.tenantA, webId, localId, type],
    );
  const unitElement = {
    WebId: unitWebId,
    // mixed separators as some AF clients deliver them
    Path: '\\\\SIM-AF/HDPE\\Plant/Line1\\Unit100',
  };
  const eventOf = async (webId: string) =>
    (
      await rows<{
        id: string;
        unit_id: string;
        asset_id: string | null;
        end_time: Date | null;
        duration_seconds: number | null;
        quantity: number | null;
      }>(
        `SELECT id, unit_id, asset_id, end_time, duration_seconds, quantity::float8 AS quantity FROM production_events WHERE event_id = $1 AND tenant_id = $2`,
        [webId, world.tenantA],
      )
    )[0];
  const pollWindow = async () => {
    await pi.runWindow(windowJob);
    await pi.normalizeAll();
  };

  it('open frames: the sentinel is never an end time; elapsed time is not computed to 9999 (PI03, T02)', async () => {
    sim.addFrames([
      simFrame({
        webId: 'EF-OPEN',
        start: minutesAgo(20),
        end: null,
        element: unitElement,
        attributes: { Description: 'running' },
      }),
    ]);

    await pollWindow();

    const event = await eventOf('EF-OPEN');
    expect(event).toMatchObject({ unit_id: world.unitA1, end_time: null });
    expect(event.duration_seconds).toBeNull();
    const [raw] = await rows<{ end_time: string | null; raw_end: string }>(
      `SELECT payload->>'endTime' AS end_time, payload->'provenance'->'rawPayload'->'frame'->>'EndTime' AS raw_end
         FROM raw_observations WHERE source_object_id = 'EF-OPEN'`,
    );
    expect(raw).toEqual({ end_time: null, raw_end: OPEN_SENTINEL });
    expect(
      await countRows(
        harness.dataSource,
        'pi_open_frames',
        `web_id = 'EF-OPEN'`,
      ),
    ).toBe(1);
  });

  it('T08: a frame open since before the lookback closes outside the window; the open-frame refresh captures it', async () => {
    sim.addFrames([
      simFrame({
        webId: 'EF-LONG',
        start: minutesAgo(10 * DAY_MINUTES),
        end: null,
        element: unitElement,
      }),
    ]);
    await pollWindow();
    const opened = await eventOf('EF-LONG');
    expect(opened.end_time).toBeNull();

    const closedAt = minutesAgo(3 * DAY_MINUTES);
    sim.closeFrame('EF-LONG', closedAt.toISOString());
    await pollWindow();
    expect((await eventOf('EF-LONG')).end_time).toBeNull();

    expect(await pi.runPage(openJob)).toMatchObject({ status: 'committed' });
    await pi.normalizeAll();

    expect((await eventOf('EF-LONG')).end_time).toEqual(closedAt);
    const changes = await rows<{ type: string; version: number }>(
      `SELECT type, version FROM outbox WHERE aggregate_id = $1 ORDER BY id`,
      [opened.id],
    );
    expect(changes).toEqual([
      { type: 'EventChanged', version: 1 },
      { type: 'EventChanged', version: 2 },
    ]);
    expect(
      await countRows(
        harness.dataSource,
        'pi_open_frames',
        `web_id = 'EF-LONG'`,
      ),
    ).toBe(0);
  });

  it('an old frame corrected after closure is revised by the 7-day rescan; an unchanged rescan is a duplicate', async () => {
    const start = minutesAgo(2 * DAY_MINUTES);
    sim.addFrames([
      simFrame({
        webId: 'EF-OLD',
        start,
        end: new Date(start.getTime() + 600_000),
        element: unitElement,
        attributes: { Description: 'first', Quantity: 4 },
      }),
    ]);
    const rescan = await pi.startJob({
      mode: 'rescan',
      scopeType: 'database',
      scopeId: 'DB-HDPE',
      rescanDays: 7,
    });
    const scanned = async () => {
      await pi.runWindow(rescan);
      await pi.normalizeAll();
    };

    await scanned();
    expect((await eventOf('EF-OLD')).quantity).toBe(4);
    sim.setAttribute('EF-OLD', 'Quantity', 6);
    await scanned();
    await scanned();

    expect((await eventOf('EF-OLD')).quantity).toBe(6);
    expect(
      await countRows(
        harness.dataSource,
        'raw_observations',
        `source_object_id = 'EF-OLD'`,
      ),
    ).toBe(2);
  });

  it('digital states keep Name/Value/IsSystem; missing attributes are null, never NaN; an asset binding derives the unit', async () => {
    sim.addFrames([
      simFrame({
        webId: 'EF-DIGITAL',
        start: minutesAgo(15),
        end: minutesAgo(14),
        element: { WebId: pumpWebId, Path: null },
        attributes: {
          ReasonCode: { Name: 'Pump trip', Value: 12, IsSystem: false },
        },
      }),
    ]);

    await pollWindow();

    const event = await eventOf('EF-DIGITAL');
    expect(event).toMatchObject({
      unit_id: world.unitA1,
      asset_id: world.assetA1,
      quantity: null,
    });
    const [revision] = await rows<{ reason: unknown }>(
      `SELECT source_facts->'reason' AS reason FROM event_revisions WHERE event_id = $1 ORDER BY revision LIMIT 1`,
      [event.id],
    );
    expect(revision.reason).toEqual({
      name: 'Pump trip',
      value: 12,
      isSystem: false,
    });
  });

  it('without a batch controller, attributes are read per frame and the capability is recorded', async () => {
    sim.batchSupported = false;
    sim.addFrames([
      simFrame({
        webId: 'EF-NOBATCH',
        start: minutesAgo(5),
        end: minutesAgo(4),
        element: unitElement,
        attributes: { Quantity: 2 },
      }),
    ]);
    const before = sim.countRequests((r) => r.path.startsWith('/streamsets'));

    await pollWindow();

    expect((await eventOf('EF-NOBATCH')).quantity).toBe(2);
    expect(
      sim.countRequests((r) => r.path.startsWith('/streamsets')),
    ).toBeGreaterThan(before);
    const [connection] = await rows<{ batch: boolean }>(
      `SELECT (capabilities->>'batch')::boolean AS batch FROM integration_connections WHERE id = $1`,
      [pi.connectionId],
    );
    expect(connection.batch).toBe(false);
  });
});
