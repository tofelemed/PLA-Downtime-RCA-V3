import { randomUUID } from 'crypto';
import { countRows } from './support/intake-fixtures';
import {
  eventMessage,
  MqttSubscriberWorld,
  recentIso,
  waitFor,
} from './support/mqtt-subscriber-world';

/**
 * Plan 1.8 WP3 step 3 (a): MQTT connection + subscribe job → contract messages on the Compose broker →
 * raw observations, production events (create / close / retract), measurement samples, source health;
 * and the v2 read surface of the subscription job.
 */
describe('MQTT subscriber host end to end (plan 1.8 step 3)', () => {
  const w = new MqttSubscriberWorld();
  const elementPath = `\\\\PIAF\\HDPE\\Polymer\\Line1\\Extruder1`;
  let events: string;
  let measurements: string;
  let signalId: string;
  const eventsTopic = () => `${w.prefix}/Polymer/Line1/Extruder1/events`;
  const eventOf = (eventId: string) =>
    w.rows<{
      id: string;
      unit_id: string;
      end_time: Date | null;
      reason_code_id: string | null;
      source: string;
      physical_state: string;
    }>(
      `SELECT id, unit_id, end_time, reason_code_id, source, physical_state FROM production_events WHERE event_id = $1`,
      [eventId],
    );

  beforeAll(async () => {
    await w.start();
    await w.mapElement(elementPath, w.world.unitA1);
    events = await w.createConnection('Line 1 events', w.eventsConfig());
    measurements = await w.createConnection(
      'Line 1 measurements',
      w.measurementsConfig(),
    );
    signalId = await w.registerSignal(
      measurements,
      'F1DPwebid-throughput',
      w.world.unitA1,
    );
  });

  afterAll(async () => {
    await w.stop();
  });

  it('creates one running subscribe job per active connection, never due, and connects with the derived client id', async () => {
    const job = await w.startSubscription(events);
    expect(job).toMatchObject({ state: 'running', next_run_at: null });
    expect(job.lease_owner).toMatch(/:\d+:[0-9a-f]{8}$/);
    expect(job.health).toMatchObject({
      connected: true,
      sessionPresent: false,
      effectiveClientId: `proact-${events}`,
      configVersion: 1,
      subscribedTopics: [
        `${w.prefix}/+/+/+/events`,
        `${w.prefix}/gateway/availability`,
      ],
      parkedReason: null,
      counters: { received: 0, accepted: 0 },
    });
    const transitions = await w.rows<{ action: string; runner: string }>(
      `SELECT action, runner FROM ingestion_job_transitions WHERE job_id = $1 ORDER BY created_at`,
      [job.id],
    );
    expect(transitions.map((row) => row.action)).toEqual(['create', 'start']);
    await w.startSubscription(measurements);
  });

  it('open event → created; end_ts revision → closed; delete → retracted (one event, source MQTT)', async () => {
    const eventId = `EF-${randomUUID().slice(0, 8)}`;
    const objectId = `Extruder1:${eventId}`;
    const start = recentIso(30);
    await w.publish(
      eventsTopic(),
      eventMessage({
        eventId,
        revision: recentIso(29),
        elementPath,
        start,
        end: null,
        seq: 1,
      }),
    );
    await waitFor(
      async () => (await w.rawOutcomes(objectId)).length === 1,
      'the open event to be retained',
    );
    await w.relay();
    const [created] = await eventOf(eventId);
    expect(created).toMatchObject({
      unit_id: w.world.unitA1,
      end_time: null,
      reason_code_id: w.world.reasonR1,
      source: 'MQTT',
    });

    const end = recentIso(10);
    await w.publish(
      eventsTopic(),
      eventMessage({
        eventId,
        revision: recentIso(9),
        elementPath,
        start,
        end,
        seq: 2,
      }),
    );
    await waitFor(
      async () => (await w.rawOutcomes(objectId)).length === 2,
      'the closing revision to be retained',
    );
    await w.relay();
    const [closed] = await eventOf(eventId);
    expect(closed.id).toBe(created.id);
    expect(closed.end_time?.toISOString()).toBe(end);

    await w.publish(eventsTopic(), {
      schema_version: '1.0',
      event_id: eventId,
      revision: recentIso(5),
      operation: 'delete',
      ts: recentIso(5),
      seq: 3,
      boot_id: 'gw-01-test',
    });
    await waitFor(
      async () => (await w.rawOutcomes(objectId)).length === 3,
      'the delete to be retained',
    );
    await w.relay();
    expect(await w.rawOutcomes(objectId)).toEqual([
      'accepted',
      'revision',
      'revision',
    ]);
    const [retracted] = await eventOf(eventId);
    expect(retracted).toMatchObject({
      id: created.id,
      physical_state: 'retracted',
    });
    expect(
      await countRows(
        w.harness.dataSource,
        'production_events',
        'event_id = $1',
        [eventId],
      ),
    ).toBe(1);
  });

  it('parks an unplaceable element as unknown_template and an unresolved reason as a linked unknown_code', async () => {
    const lost = `EF-${randomUUID().slice(0, 8)}`;
    await w.publish(
      eventsTopic(),
      eventMessage({
        eventId: lost,
        revision: recentIso(20),
        elementPath: `\\\\PIAF\\HDPE\\Nowhere\\Line9\\Press9`,
        start: recentIso(25),
        end: null,
        seq: 10,
      }),
    );
    const uncoded = `EF-${randomUUID().slice(0, 8)}`;
    await w.publish(
      eventsTopic(),
      eventMessage({
        eventId: uncoded,
        revision: recentIso(19),
        elementPath,
        start: recentIso(24),
        end: null,
        seq: 11,
        attributes: { ReasonCode: 'NOT-A-CODE', Quantity: 1 },
      }),
    );
    await waitFor(
      async () => (await w.rawOutcomes(`Extruder1:${uncoded}`)).length === 1,
      'both events to be retained',
    );
    await w.relay();
    expect(await eventOf(lost)).toEqual([]);
    const [created] = await eventOf(uncoded);
    expect(created).toMatchObject({ reason_code_id: null, source: 'MQTT' });
    const exceptions = await w.openExceptions(events);
    expect(exceptions).toEqual([
      expect.objectContaining({
        error_code: 'unknown_template',
        source_object_id: `Extruder1:${lost}`,
      }),
      expect.objectContaining({
        error_code: 'unknown_code',
        source_object_id: `Extruder1:${uncoded}`,
      }),
    ]);
    expect(exceptions[1].detail.canonicalEventId).toBe(created.id);
  });

  it('stores a measurement for a registered signal and quarantines unknown_signal otherwise', async () => {
    const topic = `${w.prefix}/Polymer/Line1/Extruder1/measurements/Throughput`;
    const sample = (signal: string, seq: number) => ({
      schema_version: '1.0',
      signal,
      value: 1532,
      uom: 't',
      ts: recentIso(1),
      quality: { good: true, questionable: false, substituted: false },
      seq,
      boot_id: 'gw-01-test',
      source: 'pi-mqtt-gw-01',
    });
    await w.publish(topic, sample('F1DPwebid-throughput', 1));
    await w.publish(topic, sample('F1DPwebid-unknown', 2));
    await waitFor(
      () => w.health(measurements)?.counters.accepted === 2,
      'both samples to be retained',
    );
    await w.relay();
    expect(
      await countRows(
        w.harness.dataSource,
        'measurement_samples',
        'signal_id = $1',
        [signalId],
      ),
    ).toBe(1);
    expect(await w.openExceptions(measurements)).toEqual([
      expect.objectContaining({ error_code: 'unknown_signal' }),
    ]);
  });

  it('availability ONLINE / OFFLINE updates the source health and publishes SourceHealthChanged, never a stop', async () => {
    const topic = `${w.prefix}/gateway/availability`;
    const before = await countRows(w.harness.dataSource, 'production_events');
    await w.publish(
      topic,
      {
        schema_version: '1.0',
        state: 'ONLINE',
        ts: recentIso(2),
        seq: 0,
        boot_id: 'gw-01-test',
        pi_connected: true,
      },
      { retain: true },
    );
    await waitFor(
      async () => (await w.rawOutcomes(topic)).length === 1,
      'ONLINE',
    );
    await w.relay();
    expect((await w.job(events)).health).toMatchObject({
      sourceAvailable: true,
      sourcePiConnected: true,
    });
    await w.publish(
      topic,
      {
        schema_version: '1.0',
        state: 'OFFLINE',
        ts: recentIso(1),
        boot_id: 'gw-01-test',
      },
      { retain: true },
    );
    await waitFor(
      async () => (await w.rawOutcomes(topic)).length === 2,
      'OFFLINE',
    );
    await w.relay();
    await w.host.heartbeat();
    const job = await w.job(events);
    expect(job.health).toMatchObject({
      sourceAvailable: false,
      connected: true,
    });
    const changes = await w.rows<{ payload: { available: boolean } }>(
      `SELECT payload FROM outbox WHERE type = 'SourceHealthChanged' AND aggregate_id = $1 ORDER BY id`,
      [events],
    );
    expect(changes.map((row) => row.payload.available)).toEqual([true, false]);
    expect(await countRows(w.harness.dataSource, 'production_events')).toBe(
      before,
    );
  });

  it('GET /v2/ingestion-jobs/:id exposes the live health; the job commands work on subscribe jobs', async () => {
    const job = await w.job(events);
    const read = await w.get(`ingestion-jobs/${job.id}`).expect(200);
    expect(read.body).toMatchObject({
      state: 'running',
      nextRunAt: null,
      scope: { mode: 'subscribe', profile: 'interval_event_json' },
      health: {
        connected: true,
        effectiveClientId: `proact-${events}`,
        sourceAvailable: false,
      },
    });
    const view = read.body as {
      lastObservationAt: string | null;
      health: { counters: { received: number } };
    };
    expect(typeof view.health.counters.received).toBe('number');
    expect(
      (read.body as { lastObservationAt: string | null }).lastObservationAt,
    ).not.toBeNull();
    const paused = await w.post(`ingestion-jobs/${job.id}/pause`).expect(200);
    expect(paused.body).toMatchObject({ state: 'paused' });
    await w.host.reconcile();
    expect(w.health(events)?.connected).toBe(false);
    expect((await w.job(events)).lease_owner).toBeNull();
    await w.post(`ingestion-jobs/${job.id}/resume`).expect(200);
    await w.startSubscription(events);
    expect(w.health(events)?.connected).toBe(true);
  });
});
