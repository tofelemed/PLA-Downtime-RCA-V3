import { INestApplication } from '@nestjs/common';
import { AttributeMappingService } from '../../src/attribute-mapping/attribute-mapping.service';
import { IngestionExceptionsService } from '../../src/intake/exceptions/ingestion-exceptions.service';
import { JobRunnerService } from '../../src/intake/jobs/job-runner.service';
import { ReplayService } from '../../src/intake/replay/replay.service';
import { IntegrationModule } from '../../src/integration/integration.module';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { normalizeMatchValue } from '../../src/source-mapping/mapping-rule';
import { IntegrationHarness } from './harness';
import { PiJobDriver, usePiTestTimings } from './support/pi-certification';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { createIntegrationApp } from './support/test-app';
import { PiWebApiSimulator } from '../simulators/pi-web-api/pi-web-api-simulator';
import { minutesAgo, simFrame } from '../simulators/pi-web-api/sim-fixtures';

const UNIT_PATH = '\\\\SIM-AF\\HDPE\\Marun\\Polymer\\Line1\\Extruder1';

/**
 * Integration audit 19 Oct 2026: a real PI Web API names a frame's primary element only in
 * `Links.PrimaryReferencedElement` / `RefElementWebIds` (no embedded object, no element path) and sends
 * seven-digit fractional times. The frame must still be placed by an exact-path rule on the element
 * (path looked up by WebId), carry the delivered duration unit, and deactivating the connection stops
 * its jobs. Connection-specific attribute overrides beat newer tenant-wide ones.
 */
describe('PI Web API real response shape (integration audit)', () => {
  const harness = new IntegrationHarness();
  const sim = new PiWebApiSimulator({ shape: 'piwebapi' });
  let app: INestApplication;
  let world: EventWorld;
  let pi: PiJobDriver;
  let windowJob: string;

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
    sim.addElement(UNIT_PATH, 'F1EmEXT1');
    await harness.dataSource.query(
      `INSERT INTO source_mappings (tenant_id, connection_id, source_system, match_kind, match_value, normalized_value, precedence, target_type, target_id, version, is_active, row_version)
       VALUES ($1, $2, 'PI', 'exact_path', $3, $4, 0, 'unit', $5, 1, true, 1)`,
      [
        world.tenantA,
        pi.connectionId,
        UNIT_PATH,
        normalizeMatchValue('exact_path', UNIT_PATH),
        world.unitA1,
      ],
    );
    windowJob = await pi.startJob({
      scopeType: 'database',
      scopeId: 'DB-HDPE',
    });
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

  it('places a frame referenced only by Links on the element mapped by path', async () => {
    const start = new Date(minutesAgo(40).getTime() + 123);
    sim.addFrames([
      simFrame({
        webId: 'F1FmREAL1',
        start,
        end: minutesAgo(10),
        element: { WebId: 'F1EmEXT1', Path: UNIT_PATH },
        attributes: {
          ReasonCode: { Name: 'MECH-01', Value: 1, IsSystem: false },
          Duration: { Value: 1800, UnitsAbbreviation: 's' },
          Quantity: { Value: 6.25, UnitsAbbreviation: 't' },
        },
      }),
    ]);
    const search = (await (
      await fetch(`${sim.baseUrl}/eventframes/F1FmREAL1`, {
        headers: { Authorization: basic() },
      })
    ).json()) as { PrimaryReferencedElement?: unknown; StartTime: string };
    expect(search.PrimaryReferencedElement).toBeUndefined();
    expect(search.StartTime).toMatch(/\.\d{7}Z$/);

    await pi.runWindow(windowJob);
    await pi.normalizeAll();

    const [event] = await harness.dataSource.query<
      Array<{
        unit_id: string;
        start_time: Date;
        quantity: number;
        quantity_uom: string;
      }>
    >(
      `SELECT unit_id, start_time, quantity::float8 AS quantity, quantity_uom FROM production_events WHERE event_id = 'F1FmREAL1' AND tenant_id = $1`,
      [world.tenantA],
    );
    expect(event).toMatchObject({
      unit_id: world.unitA1,
      quantity: 6.25,
      quantity_uom: 't',
    });
    expect(event.start_time.toISOString()).toBe(start.toISOString());
    const [open] = await harness.dataSource.query<Array<{ count: number }>>(
      `SELECT count(*)::int AS count FROM ingestion_exceptions WHERE tenant_id = $1 AND state = 'open' AND error_code IN ('unknown_unit', 'mapping_ambiguous')`,
      [world.tenantA],
    );
    expect(open.count).toBe(0);
  });

  it('does not run the jobs of a deactivated connection', async () => {
    await harness.dataSource.query(
      `UPDATE integration_connections SET is_active = false WHERE id = $1`,
      [pi.connectionId],
    );
    await harness.dataSource.query(
      `UPDATE ingestion_jobs SET next_run_at = now() - interval '1 second' WHERE id = $1`,
      [windowJob],
    );
    expect(await app.get(JobRunnerService).runOnce('runner-A')).toBeNull();
    await harness.dataSource.query(
      `UPDATE integration_connections SET is_active = true WHERE id = $1`,
      [pi.connectionId],
    );
    expect(await app.get(JobRunnerService).runOnce('runner-A')).not.toBeNull();
  });

  it('a period replay leaves an irrecoverable record closed', async () => {
    sim.addElement('//SIM-AF/HDPE/Marun/Polymer/Line1/Pelletizer1', 'F1EmPEL1');
    sim.addFrames([
      simFrame({
        webId: 'F1FmPEL1',
        start: minutesAgo(30),
        end: minutesAgo(20),
        element: { WebId: 'F1EmPEL1', Path: null },
      }),
    ]);
    await harness.dataSource.query(
      `UPDATE ingestion_jobs SET committed_cursor = NULL WHERE id = $1`,
      [windowJob],
    );
    await pi.runWindow(windowJob);
    await pi.normalizeAll();
    const openOf = () =>
      harness.dataSource.query<Array<{ id: string; state: string }>>(
        `SELECT id, state FROM ingestion_exceptions WHERE tenant_id = $1 AND source_object_id = 'F1FmPEL1' ORDER BY first_seen, state DESC`,
        [world.tenantA],
      );
    const [quarantined] = await openOf();
    expect(quarantined.state).toBe('open');
    await app
      .get(IngestionExceptionsService)
      .resolve(pi.context, quarantined.id, {
        action: 'irrecoverable',
        reason: 'not accounted',
      });

    await app
      .get(ReplayService)
      .request(pi.context, pi.connectionId, { reason: 'period replay' });
    await app.get(ReplayService).runPending('replay-test');

    expect((await openOf()).map((row) => row.state)).toEqual(['irrecoverable']);
  });

  it('prefers the connection-specific attribute override over a newer tenant-wide one', async () => {
    const insert = (
      connectionId: string | null,
      version: number,
      sourceAttr: string,
    ) =>
      harness.dataSource.query(
        `INSERT INTO attribute_mapping_versions (tenant_id, template_name, connection_id, version, field_rules, effective_from, row_version)
         VALUES ($1, 'Production Loss', $2, $3, $4, now() - interval '1 day', 1)`,
        [
          world.tenantA,
          connectionId,
          version,
          JSON.stringify([
            { sourceAttr, targetField: 'shift', type: 'string' },
          ]),
        ],
      );
    await insert(pi.connectionId, 1, 'ConnectionShift');
    await insert(null, 2, 'TenantShift');
    const profile = await app
      .get(AttributeMappingService)
      .loadProfile(world.tenantA, pi.connectionId);
    expect(
      profile
        .rulesFor('Production Loss')
        .find((rule) => rule.targetField === 'shift')?.sourceAttr,
    ).toBe('ConnectionShift');
    const other = await app
      .get(AttributeMappingService)
      .loadProfile(world.tenantA, null);
    expect(
      other
        .rulesFor('Production Loss')
        .find((rule) => rule.targetField === 'shift')?.sourceAttr,
    ).toBe('TenantShift');
  });
});

function basic(): string {
  return `Basic ${Buffer.from('sim-reader:sim-only-password').toString('base64')}`;
}
