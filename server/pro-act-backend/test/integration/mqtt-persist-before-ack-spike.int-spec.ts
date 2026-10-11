import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import * as mqtt from 'mqtt';
import { IPublishPacket, MqttClient } from 'mqtt';

/**
 * SPIKE (plan 1.8 WP3 step 1, MQ04) — recorded in `plans/evidence/mqtt-certification.md`.
 *
 * Proves, against the Compose broker, that mqtt.js delays PUBACK until the `handleMessage(packet, done)`
 * callback runs: a subscriber acks the first messages, holds the callback of the next one, is torn down
 * without DISCONNECT, and reconnects with the same client id and `clean: false`. The broker must redeliver
 * every message whose callback never ran and none whose callback did. Run for MQTT 5 and 3.1.1.
 *
 * Needs the `mqtt` Compose service (host port 1884 by default): `MQTT_TEST_URL` overrides the URL. For an
 * authenticated or TLS listener (step 4: `mqtts://localhost:8885`) set `MQTT_TEST_USERNAME` /
 * `MQTT_TEST_PASSWORD` (a user allowed to publish on `spike/#`, e.g. the dev `proact-sim`) and
 * `MQTT_TEST_CA` (PEM path, e.g. docker/mosquitto/certs/dev-ca.crt). No database is used.
 */
const BROKER_URL = process.env.MQTT_TEST_URL ?? 'mqtt://localhost:1884';
const CA_PEM = process.env.MQTT_TEST_CA
  ? readFileSync(process.env.MQTT_TEST_CA, 'utf8')
  : null;
const MESSAGES = 25;
const ACKED_BEFORE_HOLD = 2;
const SESSION_EXPIRY_SECONDS = 300;

interface Delivery {
  payload: string;
  dup: boolean;
  messageId: number | undefined;
}

interface Session {
  client: MqttClient;
  sessionPresent: boolean;
}

function waitFor(
  predicate: () => boolean,
  timeoutMs: number,
  what: string,
): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = (): void => {
      if (predicate()) return resolve();
      if (Date.now() - started > timeoutMs) {
        return reject(new Error(`timed out waiting for ${what}`));
      }
      setTimeout(tick, 25);
    };
    tick();
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function connectOptions(
  protocolVersion: 4 | 5,
  clientId: string,
  clean: boolean,
): mqtt.IClientOptions {
  const options: mqtt.IClientOptions = {
    clientId,
    clean,
    protocolVersion,
    keepalive: 60,
    reconnectPeriod: 0,
    connectTimeout: 5_000,
    manualConnect: true,
  };
  if (protocolVersion === 5) {
    options.properties = {
      sessionExpiryInterval: clean ? 0 : SESSION_EXPIRY_SECONDS,
    };
  }
  if (process.env.MQTT_TEST_USERNAME) {
    options.username = process.env.MQTT_TEST_USERNAME;
    options.password = process.env.MQTT_TEST_PASSWORD;
  }
  if (CA_PEM) options.ca = [CA_PEM];
  return options;
}

function open(
  protocolVersion: 4 | 5,
  clientId: string,
  clean: boolean,
  handleMessage?: (packet: IPublishPacket, done: () => void) => void,
): Promise<Session> {
  const client = mqtt.connect(
    BROKER_URL,
    connectOptions(protocolVersion, clientId, clean),
  );
  if (handleMessage) client.handleMessage = handleMessage;
  return new Promise((resolve, reject) => {
    client.once('connect', (connack) =>
      resolve({ client, sessionPresent: connack.sessionPresent }),
    );
    client.once('error', reject);
    client.connect();
  });
}

/** Tears the socket down without a DISCONNECT packet (the "crash" of the subscriber). */
function crash(client: MqttClient): Promise<void> {
  return new Promise((resolve) => {
    client.once('close', () => resolve());
    client.end(true);
  });
}

function endCleanly(client: MqttClient): Promise<void> {
  return new Promise((resolve) => {
    client.end(false, {}, () => resolve());
  });
}

/** Drops the persistent session so a re-run starts clean (MQTT 3.1.1 sessions never expire). */
async function discardSession(
  protocolVersion: 4 | 5,
  clientId: string,
): Promise<void> {
  const { client } = await open(protocolVersion, clientId, true);
  await endCleanly(client);
}

async function publishAll(
  protocolVersion: 4 | 5,
  topic: string,
  count: number,
): Promise<void> {
  const { client } = await open(
    protocolVersion,
    `spike-pub-${randomUUID()}`,
    true,
  );
  for (let index = 0; index < count; index += 1) {
    await client.publishAsync(topic, `m${index}`, { qos: 1 });
  }
  await endCleanly(client);
}

describe.each([5, 4] as const)(
  '[SPIKE MQ04] mqtt.js handleMessage delays PUBACK (protocolVersion %d)',
  (protocolVersion) => {
    const run = randomUUID();
    const topic = `spike/${run}/t`;
    const subscriberId = `spike-sub-${run}`;
    const clients: MqttClient[] = [];

    afterAll(async () => {
      // endAsync resolves even when the stream is already gone (a crashed client never emits `close` again)
      for (const client of clients) await client.endAsync(true);
      await discardSession(protocolVersion, subscriberId);
    });

    it('redelivers exactly the messages whose callback never ran', async () => {
      const first: Delivery[] = [];
      let held: IPublishPacket | null = null;
      const subscriber = await open(
        protocolVersion,
        subscriberId,
        false,
        (packet, done) => {
          first.push({
            payload: packet.payload.toString(),
            dup: packet.dup,
            messageId: packet.messageId,
          });
          if (first.length <= ACKED_BEFORE_HOLD) return done();
          held = packet;
        },
      );
      clients.push(subscriber.client);
      expect(subscriber.sessionPresent).toBe(false);
      await subscriber.client.subscribeAsync(topic, { qos: 1 });

      await publishAll(protocolVersion, topic, MESSAGES);
      await waitFor(() => held !== null, 10_000, 'the held message');
      // let the two PUBACKs reach the broker before the "crash"
      await sleep(300);
      // the inbound pipeline is stalled behind the held callback: nothing beyond it was handled
      expect(first.map((d) => d.payload)).toEqual(['m0', 'm1', 'm2']);
      await crash(subscriber.client);

      const redelivered: Delivery[] = [];
      const again = await open(
        protocolVersion,
        subscriberId,
        false,
        (packet, done) => {
          redelivered.push({
            payload: packet.payload.toString(),
            dup: packet.dup,
            messageId: packet.messageId,
          });
          done();
        },
      );
      clients.push(again.client);
      expect(again.sessionPresent).toBe(true);
      // no re-subscribe: the persistent session carries the subscription and the backlog
      await waitFor(
        () => redelivered.length >= MESSAGES - ACKED_BEFORE_HOLD,
        10_000,
        'redelivery of the unacked messages',
      );
      await sleep(500);

      const expected = Array.from(
        { length: MESSAGES - ACKED_BEFORE_HOLD },
        (_, i) => `m${i + ACKED_BEFORE_HOLD}`,
      );
      expect(redelivered.map((d) => d.payload)).toEqual(expected);
      expect(redelivered[0]).toMatchObject({ payload: 'm2', dup: true });
      const dupCount = redelivered.filter((d) => d.dup).length;
      process.stdout.write(
        `[SPIKE MQ04 v${protocolVersion}] acked=${ACKED_BEFORE_HOLD} held=1 published=${MESSAGES} ` +
          `redelivered=${redelivered.length} dup=${dupCount} (broker in-flight window) ` +
          `not-dup=${redelivered.length - dupCount} (queued, never sent before the crash); ` +
          `held packetId=${(held as IPublishPacket | null)?.messageId ?? '?'} ` +
          `redelivered packetId=${redelivered[0].messageId}\n`,
      );
      await endCleanly(again.client);
    });

    it('caveat: a callback held longer than 1.5 x keepalive makes the client drop the connection', async () => {
      const keepaliveSeconds = 2;
      const events: string[] = [];
      const caveatId = `${subscriberId}-ka`;
      const client = mqtt.connect(BROKER_URL, {
        ...connectOptions(protocolVersion, caveatId, true),
        keepalive: keepaliveSeconds,
      });
      clients.push(client);
      client.handleMessage = () => {
        events.push('held');
      };
      for (const name of ['offline', 'close', 'reconnect', 'end'] as const) {
        client.on(name, () => events.push(name));
      }
      client.on('error', (error) => events.push(`error:${error.message}`));
      await new Promise<void>((resolve, reject) => {
        client.once('connect', () => resolve());
        client.once('error', reject);
        client.connect();
      });
      await client.subscribeAsync(topic, { qos: 1 });
      await publishAll(protocolVersion, `${topic}`, 1);
      await waitFor(() => events.includes('held'), 5_000, 'the held message');
      await sleep(keepaliveSeconds * 1000 * 2 + 500);
      process.stdout.write(
        `[SPIKE MQ04 v${protocolVersion}] keepalive ${keepaliveSeconds}s, callback held ${keepaliveSeconds * 2}s: events=${events.join(',')}\n`,
      );
      expect(events).toContain('error:Keepalive timeout');
      expect(events).toContain('close');
    });
  },
);
