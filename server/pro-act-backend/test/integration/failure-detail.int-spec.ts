import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { V2Module } from '../../src/v2/v2.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';
import { json, V2EventClient } from './support/v2-event-client';

interface EventBody {
  id: string;
  occurrenceId: string;
  rowVersion: number;
  failure: { mode: string | null; severity: string | null; maintainableItem: string | null };
}

const t = (time: string) => `2026-09-23T${time}:00.000Z`;

/**
 * SME D8 / D11: ISO 14224-style failure detail on a stop; MTBF counts confirmed functional failures only —
 * an unplanned stop with severity critical / degraded, or a failure mode with severity not yet given; an
 * incipient finding is not a failure.
 */
describe('failure detail and confirmed failures (SME D8, D11)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  let api: V2EventClient;
  let token: string;

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [ProductionEventModule, V2Module],
    });
    token = signToken(app, { userId: randomUUID(), tenantId: world.tenantA });
    api = new V2EventClient(app, token);
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  const stop = (start: string, failure: Record<string, unknown>) =>
    api.post('/api/v2/production-events', {
      unitId: world.unitA1,
      assetId: world.assetA1,
      eventType: 'ProductionLoss',
      scheduleClass: 'unplanned',
      startTime: t(start),
      endTime: t(`${start.slice(0, 2)}:30`),
      ...failure,
    });

  const counted = async (occurrenceId: string) =>
    (
      await harness.dataSource.query<Array<{ n: number }>>(
        `SELECT count(*)::int AS "n" FROM "failure_events_v" WHERE "occurrence_id" = $1`,
        [occurrenceId],
      )
    )[0].n;

  it('stores the detail and returns it on the event', async () => {
    const created = json<EventBody>(
      await stop('06:00', {
        failureMode: 'External leakage',
        failureSeverity: 'critical',
        maintainableItem: 'Mechanical seal',
        failureMechanism: 'Wear',
        failureCause: 'Inadequate flush',
        detectionMethod: 'Inspection',
      }).expect(201),
    );
    expect(created.failure).toMatchObject({
      mode: 'External leakage',
      severity: 'critical',
      maintainableItem: 'Mechanical seal',
    });
    expect(await counted(created.occurrenceId)).toBe(1);
  });

  it('an incipient finding is not a failure; a coded mode without severity still is', async () => {
    const incipient = json<EventBody>(
      await stop('08:00', { failureMode: 'Vibration', failureSeverity: 'incipient' }).expect(201),
    );
    expect(await counted(incipient.occurrenceId)).toBe(0);
    const pending = json<EventBody>(await stop('10:00', { failureMode: 'Seal leak' }).expect(201));
    expect(await counted(pending.occurrenceId)).toBe(1);
    const degraded = json<EventBody>(await stop('12:00', { failureSeverity: 'degraded' }).expect(201));
    expect(await counted(degraded.occurrenceId)).toBe(1);
  });

  it('refuses an unknown severity (422) and clears a value with null', async () => {
    await stop('14:00', { failureSeverity: 'minor' }).expect(422);
    const created = json<EventBody>(await stop('16:00', { failureMode: 'Seal leak' }).expect(201));
    const patched = await request(app.getHttpServer())
      .patch(`/api/v2/production-events/${created.id}`)
      .set(bearer(token))
      .set('If-Match', `"${created.rowVersion}"`)
      .send({ failureMode: null })
      .expect(200);
    expect(json<EventBody>(patched).failure.mode).toBeNull();
  });
});
