import { randomUUID } from 'crypto';
import {
  eventMessage,
  MqttSubscriberWorld,
  recentIso,
  waitFor,
} from './support/mqtt-subscriber-world';

/**
 * INT-04c (integration admin persona): a whole event lifecycle delivered in one burst — the broker
 * drains the queue of a paused subscription within milliseconds on resume — must end exactly like the
 * same messages spaced out: one production event with one revision per message. Every accepted
 * revision is normalised in order; an older revision is never skipped because a newer one exists
 * (`NormalizationService`, design §4.2 stage 13).
 */
describe('MQTT subscriber: a burst-delivered lifecycle materialises every revision (INT-04c)', () => {
  const w = new MqttSubscriberWorld();
  const elementPath = `\\\\PIAF\\HDPE\\Polymer\\Line1\\Extruder1`;
  let events: string;
  const topic = () => `${w.prefix}/Polymer/Line1/Extruder1/events`;
  const eventRows = (eventId: string) =>
    w.rows<{ id: string; end_time: Date | null; physical_state: string }>(
      `SELECT id, end_time, physical_state FROM production_events WHERE event_id = $1`,
      [eventId],
    );
  const revisionKinds = async (eventRowId: string): Promise<string[]> =>
    (
      await w.rows<{ kind: string }>(
        `SELECT kind FROM event_revisions WHERE event_id = $1 ORDER BY revision`,
        [eventRowId],
      )
    ).map((row) => row.kind);
  const sourceObject = (objectId: string) =>
    w.rows<{ state: string; canonical_event_id: string | null }>(
      `SELECT state, canonical_event_id FROM source_objects WHERE source_object_id = $1`,
      [objectId],
    );

  /** Pauses the subscription, publishes `messages` while it is paused, resumes and waits for them all. */
  const burst = async (
    objectId: string,
    messages: Record<string, unknown>[],
  ): Promise<void> => {
    const job = await w.job(events);
    await w.post(`ingestion-jobs/${job.id}/pause`).expect(200);
    await w.host.reconcile();
    expect(w.health(events)?.connected).toBe(false);
    for (const message of messages) await w.publish(topic(), message);
    await w.post(`ingestion-jobs/${job.id}/resume`).expect(200);
    await w.startSubscription(events);
    await waitFor(
      async () => (await w.rawOutcomes(objectId)).length === messages.length,
      `the ${messages.length} queued messages after the resume`,
    );
    await w.relay();
  };

  beforeAll(async () => {
    await w.start();
    await w.mapElement(elementPath, w.world.unitA1);
    events = await w.createConnection('Line 1 events', w.eventsConfig());
    await w.startSubscription(events);
  });

  afterAll(async () => {
    await w.stop();
  });

  it('open → close → attribute update → delete in one burst: one event, four revisions, retracted', async () => {
    const eventId = `EF-${randomUUID().slice(0, 8)}`;
    const objectId = `Extruder1:${eventId}`;
    const start = recentIso(40);
    const end = recentIso(20);
    const base = { eventId, elementPath, start };
    await burst(objectId, [
      eventMessage({ ...base, revision: recentIso(39), end: null, seq: 1 }),
      eventMessage({ ...base, revision: recentIso(19), end, seq: 2 }),
      eventMessage({
        ...base,
        revision: recentIso(15),
        end,
        seq: 3,
        attributes: {
          ReasonCode: 'Mechanical',
          Quantity: 15,
          Description: 'Conveyor belt tripped on overload (corrected)',
        },
      }),
      {
        schema_version: '1.0',
        event_id: eventId,
        revision: recentIso(10),
        operation: 'delete',
        ts: recentIso(10),
        seq: 4,
        boot_id: 'gw-01-test',
      },
    ]);

    expect(await w.rawOutcomes(objectId)).toEqual([
      'accepted',
      'revision',
      'revision',
      'revision',
    ]);
    const rows = await eventRows(eventId);
    expect(rows).toHaveLength(1);
    expect(rows[0].physical_state).toBe('retracted');
    expect(rows[0].end_time?.toISOString()).toBe(end);
    expect(await revisionKinds(rows[0].id)).toEqual([
      'source',
      'source',
      'source',
      'retraction',
    ]);
    expect(await sourceObject(objectId)).toEqual([
      { state: 'retracted', canonical_event_id: rows[0].id },
    ]);
    expect(await w.openExceptions(events)).toEqual([]);
  });

  it('open → close in one burst: one closed event with two revisions', async () => {
    const eventId = `EF-${randomUUID().slice(0, 8)}`;
    const objectId = `Extruder1:${eventId}`;
    const start = recentIso(30);
    const end = recentIso(5);
    const base = { eventId, elementPath, start };
    await burst(objectId, [
      eventMessage({ ...base, revision: recentIso(29), end: null, seq: 10 }),
      eventMessage({ ...base, revision: recentIso(4), end, seq: 11 }),
    ]);

    expect(await w.rawOutcomes(objectId)).toEqual(['accepted', 'revision']);
    const rows = await eventRows(eventId);
    expect(rows).toHaveLength(1);
    expect(rows[0].physical_state).toBe('closed');
    expect(rows[0].end_time?.toISOString()).toBe(end);
    expect(await revisionKinds(rows[0].id)).toEqual(['source', 'source']);
    expect(await sourceObject(objectId)).toEqual([
      { state: 'active', canonical_event_id: rows[0].id },
    ]);
  });
});
