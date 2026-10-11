import { randomUUID } from 'crypto';
import { IntakeService } from '../../src/intake/intake.service';
import { countRows } from './support/intake-fixtures';
import {
  eventMessage,
  MqttSubscriberWorld,
  recentIso,
  sleep,
  waitFor,
} from './support/mqtt-subscriber-world';

/**
 * Plan 1.8 WP3 step 3 (b) durable before ack, (c) redelivery / retained re-send / stale revision,
 * (d) poison payloads (R1, R2, R3, R4, R9, R10 of the integration plan on the Compose broker).
 */
describe('MQTT subscriber: durable-before-ack, redelivery and poison messages (plan 1.8 step 3)', () => {
  const w = new MqttSubscriberWorld();
  const elementPath = `\\\\PIAF\\HDPE\\Polymer\\Line1\\Extruder1`;
  let events: string;
  const topic = () => `${w.prefix}/Polymer/Line1/Extruder1/events`;
  const identities = (objectId: string) =>
    w.rows<{ message_id: string; duplicate_count: number }>(
      `SELECT ri.message_id, ri.duplicate_count FROM raw_identities ri
         JOIN raw_observations ro ON ro.id = ri.raw_id WHERE ro.source_object_id = $1 ORDER BY ri.received_at`,
      [objectId],
    );

  beforeAll(async () => {
    await w.start();
    await w.mapElement(elementPath, w.world.unitA1);
    events = await w.createConnection('Line 1 events', w.eventsConfig());
    await w.startSubscription(events);
  });

  afterAll(async () => {
    await w.stop();
  });

  it('(b) a persist failure is not acknowledged: the client disconnects, reconnects and the broker redelivers dup=1; accepted once', async () => {
    const intake = w.app.get(IntakeService);
    const spy = jest
      .spyOn(intake, 'accept')
      .mockRejectedValueOnce(new Error('database unavailable'));
    const eventId = `EF-${randomUUID().slice(0, 8)}`;
    const objectId = `Extruder1:${eventId}`;
    const reconnectsBefore = w.health(events)?.reconnects ?? 0;

    await w.publish(
      topic(),
      eventMessage({
        eventId,
        revision: recentIso(5),
        elementPath,
        start: recentIso(6),
        end: null,
        seq: 1,
      }),
    );
    await waitFor(
      () => w.health(events)?.persistFailed !== null,
      'the persist failure to show in the health',
    );
    expect(w.health(events)).toMatchObject({
      persistFailed: { error: 'database unavailable' },
    });
    await waitFor(
      async () => (await w.rawOutcomes(objectId)).length === 1,
      'the redelivered message to be accepted',
      20_000,
    );
    await waitFor(() => w.health(events)?.connected === true, 'reconnected');
    spy.mockRestore();

    const [raw] = await w.rows<{
      payload: { sourceControls: { mqtt: { duplicate: boolean } } };
    }>(`SELECT payload FROM raw_observations WHERE source_object_id = $1`, [
      objectId,
    ]);
    expect(raw.payload.sourceControls.mqtt.duplicate).toBe(true);
    expect(w.health(events)).toMatchObject({
      connected: true,
      persistFailed: null,
    });
    expect(w.health(events)?.counters.accepted).toBe(1);
    expect(w.health(events)?.reconnects).toBeGreaterThan(reconnectsBefore);
    await w.relay();
    expect(
      await countRows(
        w.harness.dataSource,
        'production_events',
        'event_id = $1',
        [eventId],
      ),
    ).toBe(1);
  });

  it('(c) a retained re-send is a duplicate and a late older revision is stale: one event, end time kept', async () => {
    const eventId = `EF-${randomUUID().slice(0, 8)}`;
    const objectId = `Extruder1:${eventId}`;
    const start = recentIso(60);
    const open = eventMessage({
      eventId,
      revision: recentIso(59),
      elementPath,
      start,
      end: null,
      seq: 20,
    });
    await w.publish(topic(), open);
    await waitFor(
      async () => (await w.rawOutcomes(objectId)).length === 1,
      'open',
    );
    // the gateway re-publishes the open event retained on restart (contract §4): same revision
    await w.publish(topic(), { ...open, seq: 21 }, { retain: true });
    await waitFor(
      async () => (await identities(objectId))[0]?.duplicate_count === 1,
      'the retained re-send to be counted as a duplicate',
    );
    const end = recentIso(20);
    await w.publish(
      topic(),
      eventMessage({
        eventId,
        revision: recentIso(19),
        elementPath,
        start,
        end,
        seq: 22,
      }),
    );
    await waitFor(
      async () => (await w.rawOutcomes(objectId)).length === 2,
      'end revision',
    );
    // an intermediate revision (still open) arrives after the closing one: ordered by ts, it is stale
    await w.publish(
      topic(),
      eventMessage({
        eventId,
        revision: recentIso(40),
        elementPath,
        start,
        end: null,
        seq: 23,
      }),
    );
    await waitFor(
      async () => (await w.rawOutcomes(objectId)).length === 3,
      'stale revision',
    );
    await w.relay();

    expect(await w.rawOutcomes(objectId)).toEqual([
      'accepted',
      'revision',
      'stale',
    ]);
    const rows = await w.rows<{ end_time: Date | null }>(
      `SELECT end_time FROM production_events WHERE event_id = $1`,
      [eventId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].end_time?.toISOString()).toBe(end);
    expect(w.health(events)?.counters).toMatchObject({
      duplicate: 1,
      stale: 1,
    });
  });

  it('(d) poison messages are quarantined with the decode code and acknowledged; the next message still flows', async () => {
    const before = await w.openExceptions(events);
    await w.publish(topic(), 'this is not json');
    await w.publish(topic(), 'this is not json');
    await w.publish(topic(), Buffer.alloc(70 * 1024, 0x20));
    await w.publish(
      topic(),
      eventMessage({
        eventId: 'EF-future',
        revision: new Date(Date.now() + 3_600_000).toISOString(),
        elementPath,
        start: recentIso(1),
        end: null,
        seq: 30,
      }),
    );
    const eventId = `EF-${randomUUID().slice(0, 8)}`;
    await w.publish(
      topic(),
      eventMessage({
        eventId,
        revision: recentIso(2),
        elementPath,
        start: recentIso(3),
        end: null,
        seq: 31,
      }),
    );
    await waitFor(
      async () => (await w.rawOutcomes(`Extruder1:${eventId}`)).length === 1,
      'the message after the poison ones to flow',
    );
    const exceptions = (await w.openExceptions(events)).slice(before.length);
    expect(exceptions.map((row) => [row.error_code, row.occurrences])).toEqual([
      ['not_json', 2],
      ['too_large', 1],
      ['future_timestamp', 1],
    ]);
    expect(exceptions.every((row) => row.source_object_id === topic())).toBe(
      true,
    );
    expect(exceptions[0].detail).toMatchObject({
      decodeCode: 'NOT_JSON',
      rawPayloadRef: { topic: topic(), bytes: 16 },
    });
    expect(await w.rawOutcomes(topic())).toEqual([
      'invalid',
      'invalid',
      'invalid',
    ]);
    expect(w.health(events)?.counters.quarantined).toBeGreaterThanOrEqual(4);
    await sleep(200);
    expect(w.health(events)?.connected).toBe(true);
  });
});
