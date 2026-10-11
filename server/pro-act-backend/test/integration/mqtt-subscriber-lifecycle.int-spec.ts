import { randomUUID } from 'crypto';
import { JobRunnerService } from '../../src/intake/jobs/job-runner.service';
import {
  eventMessage,
  MqttSubscriberWorld,
  recentIso,
  sleep,
  waitFor,
} from './support/mqtt-subscriber-world';

/**
 * Plan 1.8 WP3 step 3 (e) duplicate-feed park (R8), (f) pause / resume / drain / stop transitions,
 * (g) the pull runner never claims a subscribe job.
 */
describe('MQTT subscriber: duplicate feeds, job transitions, runner guard (plan 1.8 step 3)', () => {
  const w = new MqttSubscriberWorld();
  const elementPath = `\\\\PIAF\\HDPE\\Polymer\\Line1\\Extruder1`;
  let events: string;
  const topic = () => `proact/v1/${w.site}/Polymer/Line1/Extruder1/events`;
  const publishEvent = async (seq: number): Promise<string> => {
    const eventId = `EF-${randomUUID().slice(0, 8)}`;
    await w.publish(
      topic(),
      eventMessage({
        eventId,
        revision: recentIso(1),
        elementPath,
        start: recentIso(2),
        end: null,
        seq,
      }),
    );
    return `Extruder1:${eventId}`;
  };
  const actions = async (jobId: string) =>
    (
      await w.rows<{ action: string }>(
        `SELECT action FROM ingestion_job_transitions WHERE job_id = $1 ORDER BY created_at, id`,
        [jobId],
      )
    ).map((row) => row.action);

  beforeAll(async () => {
    await w.start();
    await w.mapElement(elementPath, w.world.unitA1);
    events = await w.createConnection('Line 1 events', w.eventsConfig());
    await w.startSubscription(events);
  });

  afterAll(async () => {
    await w.stop();
  });

  it('(g) the pull runner never claims a subscribe job, even when it looks due', async () => {
    const job = await w.job(events);
    await w.rows(
      `UPDATE ingestion_jobs SET next_run_at = now() - interval '1 minute', lease_owner = NULL, lease_expiry = NULL WHERE id = $1`,
      [job.id],
    );
    expect(await w.app.get(JobRunnerService).claim('runner-X')).toBeNull();
    // the host takes it back and clears next_run_at again
    await w.host.heartbeat();
    await w.host.reconcile();
    await w.startSubscription(events);
    expect((await w.job(events)).next_run_at).toBeNull();
  });

  it('(e) a later overlapping connection of the tenant is parked as a duplicate-feed loser; deactivating it retires the subscription', async () => {
    const loser = randomUUID();
    await w.rows(
      `INSERT INTO integration_connections (id, tenant_id, source_type, display_name, endpoint_config, config_version, is_active, row_version)
       VALUES ($1, $2, 'mqtt', 'Line 1 copy', $3::jsonb, 1, true, 1)`,
      [loser, w.world.tenantA, JSON.stringify(w.eventsConfig())],
    );
    await w.host.reconcile();
    await w.host.heartbeat();
    expect(w.health(loser)).toMatchObject({
      connected: false,
      parkedReason: 'duplicate_feed',
    });
    expect(w.health(loser)?.parkedDetail).toContain('Line 1 events');
    expect((await w.job(loser)).health).toMatchObject({
      parkedReason: 'duplicate_feed',
    });
    expect(w.health(events)).toMatchObject({
      connected: true,
      parkedReason: null,
    });

    await w.rows(
      `UPDATE integration_connections SET is_active = false WHERE id = $1`,
      [loser],
    );
    await w.host.reconcile();
    expect(w.health(loser)).toBeNull();
    expect((await w.job(loser)).lease_owner).toBeNull();
  });

  it('(f) pause keeps the session (the broker queues), resume drains it, stop drops the session', async () => {
    const job = await w.job(events);
    await w.post(`ingestion-jobs/${job.id}/pause`).expect(200);
    await w.host.reconcile();
    expect(w.health(events)?.connected).toBe(false);
    expect((await w.job(events)).lease_owner).toBeNull();

    const queued = await publishEvent(40);
    await sleep(300);
    expect(await w.rawOutcomes(queued)).toEqual([]);

    await w.post(`ingestion-jobs/${job.id}/resume`).expect(200);
    await w.startSubscription(events);
    expect(w.health(events)?.sessionPresent).toBe(true);
    await waitFor(
      async () => (await w.rawOutcomes(queued)).length === 1,
      'the queued message after resume',
    );

    await w.post(`ingestion-jobs/${job.id}/stop`).expect(200);
    await w.host.reconcile();
    expect(w.health(events)?.connected).toBe(false);
    const dropped = await publishEvent(41);

    await w.post(`ingestion-jobs/${job.id}/start`).expect(200);
    await w.startSubscription(events);
    expect(w.health(events)?.sessionPresent).toBe(false);
    await sleep(1_000);
    expect(await w.rawOutcomes(dropped)).toEqual([]);
    const live = await publishEvent(42);
    await waitFor(
      async () => (await w.rawOutcomes(live)).length === 1,
      'a message after the restart',
    );
    expect(await actions(job.id)).toEqual([
      'create',
      'start',
      'pause',
      'resume',
      'stop',
      'start',
    ]);
  });

  it('(f) drain unsubscribes, finishes the message in flight and stops the job (audited drained)', async () => {
    const job = await w.job(events);
    await w.post(`ingestion-jobs/${job.id}/drain`).expect(200);
    await w.host.reconcile();
    expect(await w.job(events)).toMatchObject({
      state: 'stopped',
      lease_owner: null,
    });
    expect(w.health(events)?.connected).toBe(false);
    expect((await actions(job.id)).slice(-2)).toEqual(['drain', 'drained']);
    const ignored = await publishEvent(50);
    await sleep(300);
    expect(await w.rawOutcomes(ignored)).toEqual([]);
    expect(await w.app.get(JobRunnerService).claim('runner-X')).toBeNull();
  });

  it('a configuration change restarts the client at the new version with the new filters', async () => {
    const job = await w.job(events);
    await w.post(`ingestion-jobs/${job.id}/start`).expect(200);
    await w.startSubscription(events);
    const connection = await w.get(`connections/${events}`).expect(200);
    const { rowVersion } = connection.body as { rowVersion: number };
    await w
      .http()
      .patch(`/api/v2/connections/${events}`)
      .set({ Authorization: `Bearer ${w.admin}` })
      .set('If-Match', `"${rowVersion}"`)
      .send({
        endpointConfig: w.eventsConfig({
          mqtt: {
            topics: [
              `proact/v1/${w.site}/+/+/+/events`,
              `proact/v1/${w.site}/+/+/+/alarms`,
            ],
          },
        }),
      })
      .expect(200);
    await w.host.reconcile();
    await waitFor(
      () =>
        w.health(events)?.configVersion === 2 &&
        w.health(events)?.connected === true,
      'the restart at version 2',
    );
    expect(w.health(events)?.subscribedTopics).toContain(
      `proact/v1/${w.site}/+/+/+/alarms`,
    );
    expect((await w.job(events)).state).toBe('running');
  });
});
