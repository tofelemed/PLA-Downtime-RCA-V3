import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { IntegrationModule } from '../../src/integration/integration.module';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { EventRevisionService } from '../../src/production-event/revisions/event-revision.service';
import { IntegrationHarness } from './harness';
import { countRows } from './support/intake-fixtures';
import { PiJobDriver, usePiTestTimings } from './support/pi-certification';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { createIntegrationApp } from './support/test-app';
import { PiWebApiSimulator } from '../simulators/pi-web-api/pi-web-api-simulator';
import { minutesAgo, simFrame } from '../simulators/pi-web-api/sim-fixtures';

/**
 * Plan 1.6 T46 / PI06: a deletion is confirmed only by a completed inventory comparison plus a 404 on
 * direct lookup; the canonical event is tombstoned (never deleted, user work kept). A failed listing or
 * lookup, or a frame that still exists outside the job scope, never retracts anything.
 */
describe('PI event frames: confirmed deletions (plan 1.6, T46)', () => {
  const harness = new IntegrationHarness();
  const sim = new PiWebApiSimulator();
  let app: INestApplication;
  let world: EventWorld;
  let pi: PiJobDriver;
  let inventoryJob: string;
  const rows = <T>(sql: string, params: unknown[] = []): Promise<T[]> =>
    harness.dataSource.query<T[]>(sql, params);
  const element = { WebId: 'EL-U100', Path: '\\\\SIM-AF\\HDPE\\Unit100' };

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
    await harness.dataSource.query(
      `INSERT INTO af_bindings (tenant_id, web_id, local_id, bound_type, is_active) VALUES ($1, 'EL-U100', $2, 'unit', true)`,
      [world.tenantA, world.unitA1],
    );
    const closed = (webId: string, databaseWebId = 'DB-HDPE') =>
      simFrame({
        webId,
        start: minutesAgo(24 * 60),
        end: minutesAgo(24 * 60 - 30),
        element,
        databaseWebId,
      });
    sim.addFrames([
      closed('EF-KEEP'),
      closed('EF-GONE'),
      closed('EF-ELSEWHERE', 'DB-OTHER'),
    ]);
    for (const scopeId of ['DB-HDPE', 'DB-OTHER']) {
      const job = await pi.startJob({
        mode: 'rescan',
        scopeType: 'database',
        scopeId,
        rescanDays: 7,
      });
      await pi.runWindow(job);
    }
    await pi.normalizeAll();
    inventoryJob = await pi.startJob({
      mode: 'inventory',
      scopeType: 'database',
      scopeId: 'DB-HDPE',
    });
  });

  afterEach(() => sim.clearFailures());

  afterAll(async () => {
    await harness.dataSource.query(
      `UPDATE ingestion_jobs SET state = 'stopped', lease_owner = NULL WHERE tenant_id = $1`,
      [world.tenantA],
    );
    await app?.close();
    await sim.close();
    await harness.stop();
  });

  const objectState = async (webId: string) =>
    (
      await rows<{ state: string }>(
        `SELECT state FROM source_objects WHERE connection_id = $1 AND source_object_id = $2`,
        [pi.connectionId, webId],
      )
    )[0]?.state;
  const eventOf = async (webId: string) =>
    (
      await rows<{ id: string; physical_state: string; description: string }>(
        `SELECT id, physical_state, description FROM production_events WHERE event_id = $1 AND tenant_id = $2`,
        [webId, world.tenantA],
      )
    )[0];

  it('a failed listing or a failed lookup confirms nothing', async () => {
    sim.deleteFrame('EF-GONE');
    sim.fail(
      (request) => request.query.get('selectedFields') === 'Items.WebId',
      500,
      10,
    );
    expect(await pi.runPage(inventoryJob)).toMatchObject({ status: 'failed' });
    sim.clearFailures();

    sim.fail((request) => request.path === '/batch', 500, 10);
    expect(await pi.runPage(inventoryJob)).toMatchObject({ status: 'failed' });

    expect(await objectState('EF-GONE')).toBe('active');
    expect((await eventOf('EF-GONE')).physical_state).not.toBe('retracted');
  });

  it('T46: a confirmed deletion tombstones the source object and the event; user work and history stay', async () => {
    const gone = await eventOf('EF-GONE');
    await app.get(EventRevisionService).applyUserChange({
      actor: { id: randomUUID(), kind: 'user' },
      eventId: gone.id,
      patch: { description: 'reviewed by shift lead' },
    });
    const revisionsBefore = await countRows(
      harness.dataSource,
      'event_revisions',
      'event_id = $1',
      [gone.id],
    );

    expect(await pi.runPage(inventoryJob)).toMatchObject({
      status: 'committed',
      accepted: 1,
    });
    await pi.normalizeAll();

    expect(await objectState('EF-GONE')).toBe('deleted_confirmed');
    expect(await objectState('EF-KEEP')).toBe('active');
    expect(await objectState('EF-ELSEWHERE')).toBe('active');
    const after = await eventOf('EF-GONE');
    expect(after).toMatchObject({
      physical_state: 'retracted',
      description: 'reviewed by shift lead',
    });
    expect(
      await countRows(harness.dataSource, 'event_revisions', 'event_id = $1', [
        gone.id,
      ]),
    ).toBe(revisionsBefore + 1);
    expect(
      await countRows(
        harness.dataSource,
        'outbox',
        `aggregate_id = $1 AND type = 'EventRetracted'`,
        [gone.id],
      ),
    ).toBe(1);
    const job = await pi.job(inventoryJob);
    expect(job.committed_cursor).toMatchObject({
      lastInventory: { deleted: 1 },
    });
  });

  it('a repeated comparison retracts nothing twice', async () => {
    expect(await pi.runPage(inventoryJob)).toMatchObject({
      status: 'committed',
      accepted: 0,
    });
    expect(
      await countRows(
        harness.dataSource,
        'raw_observations',
        `source_object_id = 'EF-GONE' AND operation = 'retract'`,
      ),
    ).toBe(1);
  });
});
