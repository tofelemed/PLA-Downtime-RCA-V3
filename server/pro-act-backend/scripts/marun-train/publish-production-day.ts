/**
 * Plays the plant's PI-to-MQTT gateway for the HDPE-TRAIN production day (17 Oct 2026 06:00 → 18 Oct 06:00
 * Asia/Tehran): publishes the measurement_json contract (docs/MQTT_OT_CONTRACT.md §3.2, E2E_SINGLE_EXTRUDER
 * §15.1) for EXT1-State and EXT1-Throughput, one observation per minute each, to the topics the seeded
 * connection "Extruder1 MQTT measurements" subscribes to. Pro-Act only subscribes; this script stands in for
 * the data engineering team's feed.
 *
 *   npm run db:publish-marun-day -- [--url mqtt://localhost:1885] [--username proact-sim]
 *       [--rate 100] [--from <minute>] [--to <minute>] [--dry-run]
 *
 * The broker password comes from the env `MQTT_SIM_PASSWORD` (never a flag, never logged); the defaults are
 * the bundled Compose broker's password listener and its read-write gateway user (docker/mosquitto).
 * Identity is deterministic: a fixed boot_id and seq = 2 × (minute + 30) (+1 for the counter), so a re-run
 * (whole or a --from/--to slice) is a set of duplicates to Pro-Act, never a second sample. QoS 1, not
 * retained, paced at --rate messages per second.
 */
import { Logger } from '@nestjs/common';
import { setTimeout as sleep } from 'timers/promises';
import * as mqtt from 'mqtt';
import {
  parseCliArgs,
  stringFlag,
} from '../../src/migration-cutover/cli/cli-args';
import {
  assertGuideCheckpoints,
  COUNTER_SIGNAL,
  LEAD_IN_MINUTES,
  Observation,
  productionDay,
  STATE_SIGNAL,
} from './production-day-schedule';
import { assertNoForbiddenWord } from './train-guard';

const logger = new Logger('MarunDayPublisher');

const TOPIC_PREFIX = 'proact/v1/HDPE/Polymer/Line1/Extruder1/measurements';
const BOOT_ID = 'marun-gw-01-boot-20261017';
const SOURCE = 'marun-pi-mqtt-gw-01';
const QUALITY = { good: true, questionable: false, substituted: false };
const STATE_VALUES = { RUN: 1, STOP: 0 } as const;

interface Options {
  url: string;
  username: string;
  password: string | null;
  rate: number;
  from: number;
  to: number;
  dryRun: boolean;
}

interface OutgoingMessage {
  topic: string;
  payload: Record<string, unknown>;
}

function numberFlag(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`not a number: ${value}`);
  return parsed;
}

function parseOptions(argv: readonly string[]): Options {
  const args = parseCliArgs(argv);
  const rate = numberFlag(stringFlag(args, 'rate'), 100);
  if (rate <= 0 || rate > 1000) throw new Error('--rate must be 1..1000');
  return {
    url: stringFlag(args, 'url') ?? 'mqtt://localhost:1885',
    username: stringFlag(args, 'username') ?? 'proact-sim',
    password: process.env.MQTT_SIM_PASSWORD ?? null,
    rate,
    from: numberFlag(stringFlag(args, 'from'), -LEAD_IN_MINUTES),
    to: numberFlag(stringFlag(args, 'to'), Number.MAX_SAFE_INTEGER),
    dryRun: args.flags['dry-run'] === true,
  };
}

/** The two messages of one minute: state (even seq) then counter (odd seq). */
function messagesOf(row: Observation): OutgoingMessage[] {
  const seq = 2 * (row.minute + LEAD_IN_MINUTES);
  const trailer = {
    ts: row.ts,
    quality: QUALITY,
    boot_id: BOOT_ID,
    source: SOURCE,
  };
  return [
    {
      topic: `${TOPIC_PREFIX}/${STATE_SIGNAL}`,
      payload: {
        schema_version: '1.0',
        signal: STATE_SIGNAL,
        value: { name: row.state, value: STATE_VALUES[row.state] },
        ...trailer,
        seq,
      },
    },
    {
      topic: `${TOPIC_PREFIX}/${COUNTER_SIGNAL}`,
      payload: {
        schema_version: '1.0',
        signal: COUNTER_SIGNAL,
        value: row.counter,
        uom: 't',
        ...trailer,
        seq: seq + 1,
      },
    },
  ];
}

function connect(options: Options): Promise<mqtt.MqttClient> {
  const client = mqtt.connect(options.url, {
    clientId: `marun-day-${Math.random().toString(36).slice(2, 10)}`,
    protocolVersion: 5,
    clean: true,
    keepalive: 30,
    connectTimeout: 10_000,
    reconnectPeriod: 0,
    username: options.username,
    ...(options.password !== null ? { password: options.password } : {}),
  });
  return new Promise((resolve, reject) => {
    client.once('connect', () => resolve(client));
    client.once('error', (error) => {
      client.end(true);
      reject(error);
    });
  });
}

/** Publishes in order, QoS 1, waiting for each PUBACK window; paced to `rate` messages per second. */
async function publishAll(
  client: mqtt.MqttClient,
  messages: readonly OutgoingMessage[],
  rate: number,
): Promise<void> {
  const batch = Math.max(1, Math.round(rate / 10));
  for (let i = 0; i < messages.length; i += batch) {
    const started = Date.now();
    const slice = messages.slice(i, i + batch);
    await Promise.all(
      slice.map((m) =>
        client.publishAsync(m.topic, JSON.stringify(m.payload), {
          qos: 1,
          retain: false,
        }),
      ),
    );
    const wait = (slice.length / rate) * 1000 - (Date.now() - started);
    if (wait > 0) await sleep(wait);
    if ((i / batch) % 50 === 0)
      logger.log(`published ${i + slice.length}/${messages.length}`);
  }
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  assertGuideCheckpoints();
  const rows = productionDay().filter(
    (r) => r.minute >= options.from && r.minute <= options.to,
  );
  const messages = rows.flatMap(messagesOf);
  assertNoForbiddenWord('production day messages', messages);
  logger.log(
    `${messages.length} messages, ${rows[0]?.ts ?? '-'} → ${rows[rows.length - 1]?.ts ?? '-'}, boot_id ${BOOT_ID}`,
  );
  if (options.dryRun) return;
  const client = await connect(options);
  logger.log(`connected to ${options.url} as ${options.username}`);
  try {
    await publishAll(client, messages, options.rate);
  } finally {
    await client.endAsync();
  }
  logger.log(`done: ${messages.length} messages published`);
}

main().catch((error: unknown) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
