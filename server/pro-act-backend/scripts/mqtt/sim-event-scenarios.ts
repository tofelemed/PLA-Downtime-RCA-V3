/**
 * Event-frame scenarios of the publisher simulator (contract §3.1): the lifecycle of one event, a burst
 * with unique ids, the duplicate / out-of-order cases of contract §4 and the poison messages of R9/R10.
 */
import {
  elementPathOf,
  eventDelete,
  eventUpsert,
  lossAttributes,
  nowIso,
} from './sim-messages';
import {
  eventNote,
  numberFlag,
  publish,
  Scenario,
  sleep,
} from './sim-scenario-support';

export const openClose: Scenario = {
  name: 'open-close',
  usage:
    '[--hold 5] one event: open, closed after --hold s, attribute update, delete',
  async run(ctx) {
    const holdMs = numberFlag(ctx.flags, 'hold', 5) * 1000;
    const eventId = ctx.ids.nextEventId();
    const base = {
      eventId,
      elementPath: elementPathOf(ctx.equipment),
      start: nowIso(-60),
    };
    const attributes = lossAttributes(ctx.attributeNames, 12.5);
    const open = eventUpsert(ctx.ids, {
      ...base,
      revision: nowIso(),
      end: null,
      attributes,
    });
    await publish(ctx, ctx.topics.events, open, eventNote(open, 'accepted'));
    await sleep(holdMs);
    const end = nowIso();
    const closed = eventUpsert(ctx.ids, {
      ...base,
      revision: end,
      end,
      attributes,
    });
    await publish(ctx, ctx.topics.events, closed, eventNote(closed, 'closed'));
    await sleep(1000);
    const updated = eventUpsert(ctx.ids, {
      ...base,
      revision: nowIso(),
      end,
      attributes: lossAttributes(ctx.attributeNames, 14, 'Electrical'),
    });
    const changed = eventNote(updated, 'attributes changed');
    await publish(ctx, ctx.topics.events, updated, changed);
    await sleep(1000);
    const deleted = eventDelete(ctx.ids, eventId, nowIso());
    const retraction = eventNote(deleted, 'retraction');
    await publish(ctx, ctx.topics.events, deleted, retraction);
  },
};

export const burst: Scenario = {
  name: 'burst',
  usage:
    '[--count 1000] [--rate 50] closed events with unique ids, increasing seq, one boot_id',
  async run(ctx) {
    const count = numberFlag(ctx.flags, 'count', 1000);
    const rate = numberFlag(ctx.flags, 'rate', 50);
    const intervalMs = rate > 0 ? 1000 / rate : 0;
    const elementPath = elementPathOf(ctx.equipment);
    const started = Date.now();
    for (let index = 0; index < count; index += 1) {
      const message = eventUpsert(ctx.ids, {
        eventId: ctx.ids.nextEventId(),
        elementPath,
        revision: nowIso(),
        start: nowIso(-120 - index),
        end: nowIso(-60 - index),
        attributes: lossAttributes(ctx.attributeNames, 1 + (index % 9)),
      });
      const body = JSON.stringify(message);
      await ctx.client.publishAsync(ctx.topics.events, body, { qos: 1 });
      if ((index + 1) % 100 === 0 || index + 1 === count) {
        ctx.logger.log(
          `burst ${index + 1}/${count} seq=${ctx.ids.lastSeq} boot_id=${ctx.ids.bootId}`,
        );
      }
      if (intervalMs > 0) await sleep(intervalMs);
    }
    const seconds = Math.max((Date.now() - started) / 1000, 0.001);
    ctx.logger.log(
      `burst done: ${count} events in ${seconds.toFixed(1)} s (${(count / seconds).toFixed(1)}/s), seq 0..${ctx.ids.lastSeq}`,
    );
  },
};

export const duplicates: Scenario = {
  name: 'duplicates',
  usage:
    'same event_id/revision re-sent, retained re-send, out-of-order older revision',
  async run(ctx) {
    const base = {
      eventId: ctx.ids.nextEventId(),
      elementPath: elementPathOf(ctx.equipment),
      start: nowIso(-300),
      attributes: lossAttributes(ctx.attributeNames, 7),
    };
    const topic = ctx.topics.events;
    const first = eventUpsert(ctx.ids, {
      ...base,
      end: null,
      revision: nowIso(-240),
    });
    await publish(ctx, topic, first, eventNote(first, 'accepted (open)'));
    await sleep(500);
    const second = eventUpsert(ctx.ids, {
      ...base,
      end: nowIso(-120),
      revision: nowIso(-100),
    });
    await publish(ctx, topic, second, eventNote(second, 'revision (closed)'));
    await sleep(500);
    const again = { ...second, seq: ctx.ids.nextSeq() };
    const dup = eventNote(
      again,
      'duplicate: same event_id + revision, new seq',
    );
    await publish(ctx, topic, again, dup);
    await sleep(500);
    const older = { ...first, seq: ctx.ids.nextSeq() };
    const stale = eventNote(older, 'stale: older revision after a newer one');
    await publish(ctx, topic, older, stale);
    await sleep(500);
    const retained = { ...second, seq: ctx.ids.nextSeq() };
    const note = eventNote(
      retained,
      'duplicate; retained for later subscribers',
    );
    await publish(ctx, topic, retained, note, true);
  },
};

export const poison: Scenario = {
  name: 'poison',
  usage:
    'not JSON, too large (70 KB), ts in the future, local-time ts: each quarantined, the session is not blocked',
  async run(ctx) {
    const topic = ctx.topics.events;
    const elementPath = elementPathOf(ctx.equipment);
    const valid = () =>
      eventUpsert(ctx.ids, {
        eventId: ctx.ids.nextEventId(),
        elementPath,
        revision: nowIso(),
        start: nowIso(-120),
        end: nowIso(-60),
        attributes: lossAttributes(ctx.attributeNames, 2),
      });
    await publish(ctx, topic, 'not json', '-> not_json');
    const large = valid();
    large.attributes = {
      ...(large.attributes as Record<string, unknown>),
      Description: 'x'.repeat(70 * 1024),
    };
    await publish(ctx, topic, large, '-> too_large (> 65536 bytes)');
    const future = valid();
    future.ts = nowIso(3600);
    future.revision = future.ts;
    await publish(ctx, topic, future, '-> future_timestamp (ts + 1 h)');
    const local = valid();
    local.ts = nowIso().replace('Z', '');
    await publish(ctx, topic, local, '-> schema_invalid (local-time ts)');
    const healthy = valid();
    const alive = eventNote(healthy, 'accepted: the session is still alive');
    await publish(ctx, topic, healthy, alive);
  },
};
